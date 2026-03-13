/**
 * Proximity Voice Chat — WebRTC peer-to-peer audio with Supabase signaling.
 *
 * Architecture:
 * - Uses the existing Supabase Realtime channel for WebRTC signaling
 *   (SDP offers/answers/ICE candidates) and speaking-state broadcasts.
 * - Establishes direct WebRTC peer connections for audio between players.
 * - Uses Web Audio API GainNodes for distance-based attenuation.
 * - Push-to-talk on K key: mic track is muted/unmuted (not re-acquired).
 *
 * IMPORTANT: Mic acquisition is DEFERRED by VOICE_INIT_DELAY_MS after connection
 * to prevent blocking gameplay startup.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as THREE from 'three';

// ─── Config ───
const VOICE_MAX_RANGE = 60;        // world units — silent beyond this
const VOICE_FULL_RANGE = 8;        // world units — full volume inside this
const VOICE_GAIN = 1.8;            // master gain multiplier
const VOICE_INIT_DELAY_MS = 3000;  // defer mic acquisition after connect
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode | null;
}

export interface VoiceState {
  micPermission: 'prompt' | 'granted' | 'denied' | 'error';
  isTalking: boolean;
  micReady: boolean;
  speakingPeers: Set<string>;  // remote player IDs currently transmitting
}

export function useProximityVoice(
  playerId: string,
  connected: boolean,
  channelRef: React.MutableRefObject<RealtimeChannel | null>,
  playerPositionRef: React.RefObject<THREE.Vector3>,
  remotePlayers: Map<string, { targetPosition: [number, number, number] }>,
) {
  const [micPermission, setMicPermission] = useState<VoiceState['micPermission']>('prompt');
  const [isTalking, setIsTalking] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micReadyRef = useRef(false);
  const isTalkingRef = useRef(false);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const voiceInitDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Audio context lazy init ───
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // ─── Acquire mic ───
  const acquireMic = useCallback(async () => {
    if (localStreamRef.current) return true;
    try {
      console.log('[Voice] Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      // Start muted — only unmute on push-to-talk
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
      micReadyRef.current = true;
      setMicPermission('granted');
      console.log('[Voice] Microphone acquired');
      return true;
    } catch (err: any) {
      console.warn('[Voice] Mic denied:', err.message);
      setMicPermission(err.name === 'NotAllowedError' ? 'denied' : 'error');
      return false;
    }
  }, []);

  // ─── Create peer connection to a remote player ───
  const createPeer = useCallback((remoteId: string, initiator: boolean) => {
    const channel = channelRef.current;
    if (!channel || peersRef.current.has(remoteId)) return;

    console.log(`[Voice] Creating peer → ${remoteId.slice(0, 8)} (initiator=${initiator})`);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Audio element for remote stream
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    // Muted on the element — we use Web Audio API for volume control
    audioEl.volume = 0;

    const ctx = getAudioCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(ctx.destination);

    let sourceNode: MediaElementAudioSourceNode | null = null;

    pc.ontrack = (ev) => {
      console.log(`[Voice] Got remote track from ${remoteId.slice(0, 8)}`);
      audioEl.srcObject = ev.streams[0] || new MediaStream([ev.track]);
      // Create source node from audio element
      try {
        sourceNode = ctx.createMediaElementSource(audioEl);
        sourceNode.connect(gainNode);
        const entry = peersRef.current.get(remoteId);
        if (entry) entry.sourceNode = sourceNode;
      } catch {
        // Already connected
      }
      // Need to play with Web Audio, so set element volume to 1 (audio goes through gain)
      audioEl.volume = 1;
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'voice_ice',
          payload: { from: playerId, to: remoteId, candidate: ev.candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log(`[Voice] Peer ${remoteId.slice(0, 8)} ${pc.connectionState}`);
        destroyPeer(remoteId);
      }
    };

    peersRef.current.set(remoteId, { pc, audioEl, gainNode, sourceNode });

    // Initiate if we're the initiator (alphabetically higher ID initiates)
    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'voice_offer',
            payload: { from: playerId, to: remoteId, sdp: offer },
          });
        } catch (err) {
          console.warn('[Voice] Offer error:', err);
        }
      })();
    }
  }, [playerId, getAudioCtx]);

  // ─── Destroy peer ───
  const destroyPeer = useCallback((remoteId: string) => {
    const entry = peersRef.current.get(remoteId);
    if (!entry) return;
    entry.pc.close();
    entry.audioEl.srcObject = null;
    entry.audioEl.remove();
    if (entry.sourceNode) {
      try { entry.sourceNode.disconnect(); } catch {}
    }
    entry.gainNode.disconnect();
    peersRef.current.delete(remoteId);
  }, []);

  // ─── Handle signaling events ───
  const setupSignaling = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // Clean previous listeners
    if (cleanupListenersRef.current) cleanupListenersRef.current();

    const handleOffer = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      console.log(`[Voice] Received offer from ${payload.from.slice(0, 8)}`);
      
      if (!peersRef.current.has(payload.from)) {
        createPeer(payload.from, false);
      }
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;

      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'voice_answer',
          payload: { from: playerId, to: payload.from, sdp: answer },
        });
      } catch (err) {
        console.warn('[Voice] Answer error:', err);
      }
    };

    const handleAnswer = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (err) {
        console.warn('[Voice] SetRemote error:', err);
      }
    };

    const handleIce = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.warn('[Voice] ICE error:', err);
      }
    };

    const handleSpeaking = ({ payload }: any) => {
      if (payload.playerId === playerId) return;
      setSpeakingPeers(prev => {
        const next = new Set(prev);
        if (payload.speaking) next.add(payload.playerId);
        else next.delete(payload.playerId);
        return next;
      });
    };

    channel.on('broadcast', { event: 'voice_offer' }, handleOffer);
    channel.on('broadcast', { event: 'voice_answer' }, handleAnswer);
    channel.on('broadcast', { event: 'voice_ice' }, handleIce);
    channel.on('broadcast', { event: 'voice_speaking' }, handleSpeaking);

    cleanupListenersRef.current = () => {
      cleanupListenersRef.current = null;
    };
  }, [playerId, createPeer]);

  // ─── Start talking (K down) ───
  const startTalking = useCallback(async () => {
    if (isTalkingRef.current) return;
    if (!localStreamRef.current) {
      const ok = await acquireMic();
      if (!ok) return;
    }

    isTalkingRef.current = true;
    setIsTalking(true);

    // Enable mic tracks
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });

    // Broadcast speaking state
    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice_speaking',
      payload: { playerId, speaking: true },
    });

    console.log('[Voice] Transmitting...');
  }, [playerId, acquireMic]);

  // ─── Stop talking (K up) ───
  const stopTalking = useCallback(() => {
    if (!isTalkingRef.current) return;
    isTalkingRef.current = false;
    setIsTalking(false);

    // Mute mic tracks
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });

    // Broadcast stop
    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice_speaking',
      payload: { playerId, speaking: false },
    });

    console.log('[Voice] Stopped transmitting');
  }, [playerId]);

  // ─── Update distance-based gain every frame ───
  const updateProximityGain = useCallback(() => {
    const pos = playerPositionRef.current;
    if (!pos) return;

    for (const [remoteId, entry] of peersRef.current) {
      const remote = remotePlayers.get(remoteId);
      if (!remote) {
        entry.gainNode.gain.value = 0;
        continue;
      }
      const dx = pos.x - remote.targetPosition[0];
      const dz = pos.z - remote.targetPosition[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      let vol = 0;
      if (dist <= VOICE_FULL_RANGE) {
        vol = VOICE_GAIN;
      } else if (dist < VOICE_MAX_RANGE) {
        // Smooth falloff
        const t = (dist - VOICE_FULL_RANGE) / (VOICE_MAX_RANGE - VOICE_FULL_RANGE);
        vol = VOICE_GAIN * (1 - t * t); // quadratic falloff
      }
      // Smooth the gain transition to avoid clicks
      entry.gainNode.gain.value += (vol - entry.gainNode.gain.value) * 0.15;
    }
  }, [playerPositionRef, remotePlayers]);

  // ─── Establish peers when remote players join ───
  const syncPeers = useCallback(() => {
    if (!connected || !micReadyRef.current) return;

    // Create peers for new remote players
    for (const [remoteId] of remotePlayers) {
      if (!peersRef.current.has(remoteId)) {
        // Deterministic initiator: alphabetically higher ID initiates
        const initiator = playerId > remoteId;
        createPeer(remoteId, initiator);
      }
    }

    // Remove peers for players that left
    for (const [peerId] of peersRef.current) {
      if (!remotePlayers.has(peerId)) {
        destroyPeer(peerId);
        setSpeakingPeers(prev => {
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        });
      }
    }
  }, [connected, remotePlayers, playerId, createPeer, destroyPeer]);

  // ─── K key handler ───
  useEffect(() => {
    if (!connected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && !e.repeat) {
        startTalking();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyK') {
        stopTalking();
      }
    };
    const onBlur = () => {
      stopTalking();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      stopTalking();
    };
  }, [connected, startTalking, stopTalking]);

  // ─── Setup signaling when connected ───
  useEffect(() => {
    if (connected && channelRef.current) {
      setupSignaling();
    }
  }, [connected, setupSignaling]);

  // ─── Sync peers on remote player changes ───
  useEffect(() => {
    syncPeers();
  }, [syncPeers]);

  // ─── Proximity gain update loop ───
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(updateProximityGain, 50); // 20Hz
    return () => clearInterval(interval);
  }, [connected, updateProximityGain]);

  // ─── Cleanup on disconnect/unmount ───
  useEffect(() => {
    return () => {
      if (voiceInitDelayRef.current) clearTimeout(voiceInitDelayRef.current);
      for (const [id] of peersRef.current) {
        destroyPeer(id);
      }
      peersRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      micReadyRef.current = false;
    };
  }, [destroyPeer]);

  // ─── DEFERRED mic init — wait VOICE_INIT_DELAY_MS after connect ───
  useEffect(() => {
    if (connected && !localStreamRef.current && micPermission === 'prompt') {
      console.log(`[Voice] Deferring mic acquisition by ${VOICE_INIT_DELAY_MS}ms to avoid blocking startup`);
      voiceInitDelayRef.current = setTimeout(() => {
        console.log('[Voice] Deferred mic init starting now');
        acquireMic();
      }, VOICE_INIT_DELAY_MS);
      return () => {
        if (voiceInitDelayRef.current) {
          clearTimeout(voiceInitDelayRef.current);
          voiceInitDelayRef.current = null;
        }
      };
    }
  }, [connected, acquireMic, micPermission]);

  return {
    micPermission,
    isTalking,
    micReady: micReadyRef.current,
    speakingPeers,
    startTalking,
    stopTalking,
  };
}
