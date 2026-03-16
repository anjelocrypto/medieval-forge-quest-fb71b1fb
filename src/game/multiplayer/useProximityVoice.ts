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
 * Reliability design:
 * - Peers are created immediately when remote players appear (no mic gate).
 * - Late mic acquisition adds tracks to all existing peers + renegotiates.
 * - ICE candidates are buffered until remote description is set.
 * - A voice_ready handshake ensures late joiners are discovered by existing peers.
 * - audioEl.play() is called explicitly to handle autoplay restrictions.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as THREE from 'three';

// ─── Config ───
const VOICE_MAX_RANGE = 40;         // world units — completely silent beyond
const VOICE_FULL_RANGE = 15;        // world units — full volume inside
const VOICE_GAIN = 1.6;             // master gain multiplier
const VOICE_SILENCE_THRESHOLD = 0.005; // below this gain → hard zero
const VOICE_INIT_DELAY_MS = 3000;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const PEER_RETRY_DELAY_MS = 2000;
const PEER_RETRY_MAX = 3;

// ─── Rate-limited voice logger ───
const vLog: Record<string, number> = {};
function voiceLog(label: string, data?: Record<string, unknown>) {
  const c = vLog[label] ?? 0;
  if (c >= 8) return;
  vLog[label] = c + 1;
  const s = data ? ' — ' + JSON.stringify(data) : '';
  console.log(`[Voice] ${label}${s}`);
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode | null;
  hasRemoteDesc: boolean;
  iceCandidateBuffer: RTCIceCandidateInit[];
  retryCount: number;
}

export interface VoiceState {
  micPermission: 'prompt' | 'granted' | 'denied' | 'error';
  isTalking: boolean;
  micReady: boolean;
  speakingPeers: Set<string>;
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
  const voiceInitDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalingSetupRef = useRef(false);
  const connectedRef = useRef(false);
  connectedRef.current = connected;

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

  // ─── Destroy peer (defined early for use in createPeer) ───
  const destroyPeer = useCallback((remoteId: string) => {
    const entry = peersRef.current.get(remoteId);
    if (!entry) return;
    voiceLog('destroyPeer', { remoteId: remoteId.slice(0, 8) });
    try { entry.pc.close(); } catch {}
    entry.audioEl.srcObject = null;
    try { entry.audioEl.remove(); } catch {}
    if (entry.sourceNode) {
      try { entry.sourceNode.disconnect(); } catch {}
    }
    try { entry.gainNode.disconnect(); } catch {}
    peersRef.current.delete(remoteId);
  }, []);

  // ─── Create peer connection to a remote player ───
  const createPeer = useCallback((remoteId: string, initiator: boolean) => {
    const channel = channelRef.current;
    if (!channel) {
      voiceLog('createPeer skipped: no channel', { remoteId: remoteId.slice(0, 8) });
      return;
    }

    // If peer already exists and is not failed, skip
    const existing = peersRef.current.get(remoteId);
    if (existing) {
      const state = existing.pc.connectionState;
      if (state !== 'failed' && state !== 'closed') return;
      // Clean up failed peer before recreating
      destroyPeer(remoteId);
    }

    voiceLog('createPeer', { remoteId: remoteId.slice(0, 8), initiator });
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks if available (may not be yet — that's OK, we'll add later)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Audio element for remote stream
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.volume = 0; // We route through Web Audio API gain

    const ctx = getAudioCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(ctx.destination);

    const entry: PeerEntry = {
      pc, audioEl, gainNode,
      sourceNode: null,
      hasRemoteDesc: false,
      iceCandidateBuffer: [],
      retryCount: 0,
    };

    pc.ontrack = (ev) => {
      voiceLog('ontrack', { from: remoteId.slice(0, 8), tracks: ev.streams.length });
      const stream = ev.streams[0] || new MediaStream([ev.track]);
      audioEl.srcObject = stream;

      // Create Web Audio source node
      if (!entry.sourceNode) {
        try {
          entry.sourceNode = ctx.createMediaElementSource(audioEl);
          entry.sourceNode.connect(gainNode);
        } catch {
          // Already connected — safe to ignore
        }
      }

      // Set volume to 1 so audio flows through gain node
      audioEl.volume = 1;

      // Explicitly play to handle autoplay restrictions
      audioEl.play().catch(err => {
        voiceLog('audioEl.play() blocked', { err: err.message });
      });
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
      const state = pc.connectionState;
      voiceLog('peerState', { remote: remoteId.slice(0, 8), state });

      if (state === 'failed') {
        // Retry logic
        const peerEntry = peersRef.current.get(remoteId);
        if (peerEntry && peerEntry.retryCount < PEER_RETRY_MAX) {
          const retryCount = peerEntry.retryCount + 1;
          voiceLog('peer retry', { remote: remoteId.slice(0, 8), attempt: retryCount });
          destroyPeer(remoteId);
          setTimeout(() => {
            if (connectedRef.current && remotePlayers.has(remoteId)) {
              const newInitiator = playerId > remoteId;
              createPeer(remoteId, newInitiator);
              // Track retry count on new entry
              const newEntry = peersRef.current.get(remoteId);
              if (newEntry) newEntry.retryCount = retryCount;
            }
          }, PEER_RETRY_DELAY_MS);
        } else {
          destroyPeer(remoteId);
        }
      } else if (state === 'closed') {
        destroyPeer(remoteId);
      }
    };

    peersRef.current.set(remoteId, entry);

    // Initiate if we're the initiator (deterministic: alphabetically higher ID)
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
          voiceLog('offer sent', { to: remoteId.slice(0, 8) });
        } catch (err: any) {
          voiceLog('offer error', { err: err.message });
        }
      })();
    }
  }, [playerId, getAudioCtx, destroyPeer, remotePlayers]);

  // ─── Flush buffered ICE candidates ───
  const flushIceBuffer = useCallback(async (remoteId: string) => {
    const entry = peersRef.current.get(remoteId);
    if (!entry || !entry.hasRemoteDesc) return;

    const buffered = entry.iceCandidateBuffer.splice(0);
    for (const candidate of buffered) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err: any) {
        voiceLog('buffered ICE add error', { err: err.message });
      }
    }
    if (buffered.length > 0) {
      voiceLog('flushed ICE buffer', { remoteId: remoteId.slice(0, 8), count: buffered.length });
    }
  }, []);

  // ─── Add tracks to all existing peers (after late mic acquisition) ───
  const addTracksToAllPeers = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    for (const [remoteId, entry] of peersRef.current) {
      const senders = entry.pc.getSenders();
      const hasAudioSender = senders.some(s => s.track?.kind === 'audio');
      if (hasAudioSender) continue;

      voiceLog('adding tracks to existing peer', { remoteId: remoteId.slice(0, 8) });
      stream.getTracks().forEach(track => {
        entry.pc.addTrack(track, stream);
      });

      // Renegotiate if we're the initiator
      const channel = channelRef.current;
      if (!channel) continue;
      const initiator = playerId > remoteId;
      if (initiator) {
        try {
          const offer = await entry.pc.createOffer();
          await entry.pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'voice_offer',
            payload: { from: playerId, to: remoteId, sdp: offer },
          });
          voiceLog('renegotiation offer sent', { to: remoteId.slice(0, 8) });
        } catch (err: any) {
          voiceLog('renegotiation error', { err: err.message });
        }
      }
    }
  }, [playerId]);

  // ─── Acquire mic ───
  const acquireMic = useCallback(async () => {
    if (localStreamRef.current) return true;
    try {
      voiceLog('requesting mic');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      // Start muted — only unmute on push-to-talk
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
      micReadyRef.current = true;
      setMicPermission('granted');
      voiceLog('mic acquired');

      // KEY FIX: Add tracks to all already-created peers and renegotiate
      await addTracksToAllPeers();

      // Broadcast voice_ready so existing peers know we can receive
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice_ready',
        payload: { playerId },
      });

      return true;
    } catch (err: any) {
      voiceLog('mic denied', { err: err.message });
      setMicPermission(err.name === 'NotAllowedError' ? 'denied' : 'error');
      return false;
    }
  }, [playerId, addTracksToAllPeers]);

  // ─── Handle signaling events ───
  const setupSignaling = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || signalingSetupRef.current) return;
    signalingSetupRef.current = true;

    voiceLog('setupSignaling');

    const handleOffer = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      voiceLog('received offer', { from: payload.from.slice(0, 8) });

      // Create peer if needed (non-initiator side)
      if (!peersRef.current.has(payload.from)) {
        createPeer(payload.from, false);
      }
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;

      try {
        // Handle renegotiation: if we already have a remote desc, handle gracefully
        const signalingState = entry.pc.signalingState;
        if (signalingState === 'stable') {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (signalingState === 'have-local-offer') {
          // Glare: both sides sent offers. Lower ID rolls back.
          if (playerId < payload.from) {
            voiceLog('glare: rolling back', { signalingState });
            await entry.pc.setLocalDescription({ type: 'rollback' } as any);
            await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } else {
            voiceLog('glare: ignoring remote offer (we have priority)');
            return;
          }
        } else {
          await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }

        entry.hasRemoteDesc = true;
        await flushIceBuffer(payload.from);

        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'voice_answer',
          payload: { from: playerId, to: payload.from, sdp: answer },
        });
        voiceLog('answer sent', { to: payload.from.slice(0, 8) });
      } catch (err: any) {
        voiceLog('answer error', { err: err.message });
      }
    };

    const handleAnswer = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        entry.hasRemoteDesc = true;
        await flushIceBuffer(payload.from);
        voiceLog('answer applied', { from: payload.from.slice(0, 8) });
      } catch (err: any) {
        voiceLog('setRemote error', { err: err.message });
      }
    };

    const handleIce = async ({ payload }: any) => {
      if (payload.to !== playerId) return;
      const entry = peersRef.current.get(payload.from);
      if (!entry) {
        voiceLog('ICE for unknown peer (buffering)', { from: payload.from.slice(0, 8) });
        // Can't buffer without a peer entry — will be handled when peer is created
        return;
      }

      if (!entry.hasRemoteDesc) {
        // Buffer until remote description is set
        entry.iceCandidateBuffer.push(payload.candidate);
        voiceLog('ICE buffered', { from: payload.from.slice(0, 8), buffered: entry.iceCandidateBuffer.length });
        return;
      }

      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err: any) {
        voiceLog('ICE add error', { err: err.message });
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

    // When a remote player announces voice_ready, create peer if needed
    const handleVoiceReady = ({ payload }: any) => {
      if (payload.playerId === playerId) return;
      voiceLog('voice_ready received', { from: payload.playerId.slice(0, 8) });

      if (!peersRef.current.has(payload.playerId)) {
        const initiator = playerId > payload.playerId;
        createPeer(payload.playerId, initiator);
      } else {
        // Peer exists but may need renegotiation if they just got their mic
        const entry = peersRef.current.get(payload.playerId);
        if (entry && entry.pc.connectionState === 'connected') {
          voiceLog('peer already connected, voice_ready is informational');
        }
      }
    };

    channel.on('broadcast', { event: 'voice_offer' }, handleOffer);
    channel.on('broadcast', { event: 'voice_answer' }, handleAnswer);
    channel.on('broadcast', { event: 'voice_ice' }, handleIce);
    channel.on('broadcast', { event: 'voice_speaking' }, handleSpeaking);
    channel.on('broadcast', { event: 'voice_ready' }, handleVoiceReady);
  }, [playerId, createPeer, flushIceBuffer]);

  // ─── Sync peers when remote players change ───
  // KEY FIX: No micReadyRef gate — peers are created regardless of mic state.
  // Receiving audio does NOT require having a mic.
  const syncPeers = useCallback(() => {
    if (!connected) return;

    // Create peers for new remote players
    for (const [remoteId] of remotePlayers) {
      if (!peersRef.current.has(remoteId)) {
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

  // ─── Start talking (K down) ───
  const startTalking = useCallback(async () => {
    if (isTalkingRef.current) return;
    if (!localStreamRef.current) {
      const ok = await acquireMic();
      if (!ok) return;
    }

    isTalkingRef.current = true;
    setIsTalking(true);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });

    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice_speaking',
      payload: { playerId, speaking: true },
    });
    voiceLog('transmitting');
  }, [playerId, acquireMic]);

  // ─── Stop talking (K up) ───
  const stopTalking = useCallback(() => {
    if (!isTalkingRef.current) return;
    isTalkingRef.current = false;
    setIsTalking(false);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });

    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice_speaking',
      payload: { playerId, speaking: false },
    });
  }, [playerId]);

  // ─── Update distance-based gain ───
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
        const t = (dist - VOICE_FULL_RANGE) / (VOICE_MAX_RANGE - VOICE_FULL_RANGE);
        vol = VOICE_GAIN * (1 - t * t);
      }
      entry.gainNode.gain.value += (vol - entry.gainNode.gain.value) * 0.15;
    }
  }, [playerPositionRef, remotePlayers]);

  // ─── K key handler ───
  useEffect(() => {
    if (!connected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && !e.repeat) startTalking();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyK') stopTalking();
    };
    const onBlur = () => stopTalking();

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
    if (!connected) {
      signalingSetupRef.current = false;
    }
  }, [connected, setupSignaling]);

  // ─── Sync peers on remote player changes ───
  useEffect(() => {
    syncPeers();
  }, [syncPeers]);

  // ─── Proximity gain update loop ───
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(updateProximityGain, 50);
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
      signalingSetupRef.current = false;
      // Reset log counts
      for (const k of Object.keys(vLog)) delete vLog[k];
    };
  }, [destroyPeer]);

  // ─── DEFERRED mic init ───
  useEffect(() => {
    if (connected && !localStreamRef.current && micPermission === 'prompt') {
      voiceLog('deferring mic acquisition', { delayMs: VOICE_INIT_DELAY_MS });
      voiceInitDelayRef.current = setTimeout(() => {
        voiceLog('deferred mic init starting');
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

  // ─── Resume AudioContext on first user interaction (autoplay policy) ───
  useEffect(() => {
    if (!connected) return;
    const resume = () => {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
        voiceLog('AudioContext resumed on user gesture');
      }
    };
    window.addEventListener('click', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
    return () => {
      window.removeEventListener('click', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [connected]);

  return {
    micPermission,
    isTalking,
    micReady: micReadyRef.current,
    speakingPeers,
    startTalking,
    stopTalking,
  };
}
