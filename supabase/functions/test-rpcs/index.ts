import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: any[] = [];

  async function test(name: string, fn: () => Promise<any>) {
    try {
      const result = await fn();
      results.push({ test: name, status: "OK", data: result.data, error: result.error?.message ?? null });
    } catch (e: any) {
      results.push({ test: name, status: "CAUGHT", error: e.message });
    }
  }

  // Clean up any previous test data
  // Can't delete directly due to RLS deny_all, but we can use service_role which bypasses RLS
  // Actually service_role bypasses RLS, so direct delete works
  await supabase.from("player_accounts").delete().eq("wallet_address", "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C");
  await supabase.from("player_accounts").delete().eq("wallet_address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

  // ===== CREATE WALLET ACCOUNT =====

  // 1a: Valid create with all fields
  await test("create: valid full", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _display_name: "TestKnight",
      _community_name: "TestGuild",
      _character_type: "goblin",
    })
  );

  // 1b: Duplicate wallet
  await test("create: duplicate wallet", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _display_name: "Another",
      _character_type: "soldier",
    })
  );

  // 1c: Invalid wallet format
  await test("create: invalid wallet", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "not-a-wallet!!!",
      _display_name: "Bad",
      _character_type: "goblin",
    })
  );

  // 1d: Empty display name (should default to Knight)
  await test("create: empty display name", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      _display_name: "",
      _character_type: "soldier",
    })
  );

  // 1e: Invalid character type
  await test("create: invalid character", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
      _display_name: "Test",
      _character_type: "dragon",
    })
  );

  // 1f: Null community name
  await test("create: null community", () =>
    supabase.rpc("create_wallet_account", {
      _wallet_address: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
      _display_name: "NoCommunity",
      _character_type: "goblin",
    })
  );

  // ===== LOGIN WALLET ACCOUNT =====

  // 2a: Existing wallet
  await test("login: existing wallet", () =>
    supabase.rpc("login_wallet_account", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
    })
  );

  // 2b: Non-existing wallet
  await test("login: non-existing wallet", () =>
    supabase.rpc("login_wallet_account", {
      _wallet_address: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
    })
  );

  // 2c: Invalid wallet format
  await test("login: invalid wallet", () =>
    supabase.rpc("login_wallet_account", {
      _wallet_address: "0xinvalid",
    })
  );

  // ===== UPDATE WALLET PROFILE =====

  // 3a: Update only display name
  await test("profile: update name only", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _display_name: "NewName",
    })
  );

  // 3b: Update only community name
  await test("profile: update community only", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _community_name: "NewGuild",
    })
  );

  // 3c: Update only character type
  await test("profile: update char only", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _character_type: "soldier",
    })
  );

  // 3d: Update all three
  await test("profile: update all", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _display_name: "FullUpdate",
      _community_name: "FullGuild",
      _character_type: "goblin",
    })
  );

  // 3e: Invalid character type
  await test("profile: invalid char", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _character_type: "dragon",
    })
  );

  // 3f: Unknown wallet
  await test("profile: unknown wallet", () =>
    supabase.rpc("update_wallet_profile", {
      _wallet_address: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
      _display_name: "Ghost",
    })
  );

  // ===== UPDATE WALLET LAST POSITION =====

  // 4a: Valid position update
  await test("position: valid update", () =>
    supabase.rpc("update_wallet_last_position", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _last_position_x: 100.5,
      _last_position_y: 2.0,
      _last_position_z: -50.3,
    })
  );

  // 4b: Unknown wallet
  await test("position: unknown wallet", () =>
    supabase.rpc("update_wallet_last_position", {
      _wallet_address: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
      _last_position_x: 0,
      _last_position_y: 0,
      _last_position_z: 0,
    })
  );

  // 4c: Repeated update (overwrite)
  await test("position: repeated update", () =>
    supabase.rpc("update_wallet_last_position", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
      _last_position_x: 200.0,
      _last_position_y: 5.5,
      _last_position_z: 300.0,
    })
  );

  // ===== VERIFY FINAL STATE =====
  // Login again to see final state after all updates
  await test("final: login to verify state", () =>
    supabase.rpc("login_wallet_account", {
      _wallet_address: "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C",
    })
  );

  // Check the empty-name account
  await test("final: login empty-name account", () =>
    supabase.rpc("login_wallet_account", {
      _wallet_address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    })
  );

  // Cleanup test data
  await supabase.from("player_accounts").delete().eq("wallet_address", "DRpbCBMxVnDK7maPMoGQhFnak1tBbfBZ4fKnMBVNSj6C");
  await supabase.from("player_accounts").delete().eq("wallet_address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
  await supabase.from("player_accounts").delete().eq("wallet_address", "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T");

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
