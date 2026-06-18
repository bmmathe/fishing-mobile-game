# Product Requirements Document (PRD)
**Project Name:** *Tidal Ties* (Working Title) - Social Fishing Game
**Document Date:** June 17, 2026
**Status:** Draft / Concept phase

---

## 1. Executive Summary
*Tidal Ties* is a real-time, highly social multiplayer fishing simulation game. It combines skill-based fishing mechanics with a robust player-driven economy and real-estate management system. Players compete for highly sought-after, limited-occupancy fishing spots, trade catches, and progress from simple shorefishers to captains of their own customized fishing boats. The game emphasizes social interaction, dynamic markets, and strategic progression.

## 2. Core Gameplay Loop
1. **Acquire a Spot:** Secure a fishing spot (either by finding an open slot, paying dynamic entry fees, or buying out another player's spot).
2. **Fish:** Utilize skill-based fishing mechanics, leveraging current gear and bait.
3. **Harvest & Manage:** Catch fish (standard or seasonal) and decide whether to sell them to the standard merchant, auction them to other players, or display them on a personal Trophy Wall.
4. **Upgrade & Expand:** Reinvest earnings into better poles, exclusive bait, or personal boats (paying maintenance/storage) to access higher-tier fish pools and exclusive deep-water locations.

---

## 3. Key Features & Mechanics

### 3.1. Locations & Real-Time Occupancy
* **Diverse Biomes:** Multiple lakes, ocean piers, and beachside locations, each featuring distinct "pools" of fish species.
* **Real-Time Occupancy Limits:** Every location has a strict maximum occupancy (e.g., the Ocean Dock holds a maximum of 10 players). 
* **Session Management:** When a player's session ends (app closed, timeout, manual departure), their spot immediately becomes available in real-time.
* **Dynamic Pricing (Foot-Only Spots):** Entry costs for terrestrial spots (beachside, lakeside, pier) fluctuate dynamically based on current popularity and server demand.
* **Player-to-Player Spot Trading:** Players currently occupying a highly contested spot can field real-time offers and sell their spot to waiting players for in-game currency.

### 3.2. Fishing Mechanics & Gear Progression
* **Skill-Based Minigames:** Catching fish requires mechanical skill, ensuring gameplay remains engaging. 
* **Gear Dependencies:** Upgrading gear (poles, lines, reels) makes the fishing mechanics easier and is heavily gatekept by tier. High-tier fish will snap low-tier lines or escape low-tier gear.
* **The Bait Economy:** * Standard bait can be bought from NPC merchants.
  * *Premium/Best Bait* is entirely player-driven: it cannot be purchased from NPCs. It must be caught manually or purchased from other players via the Auction House.

### 3.3. Boats & Advanced Fishing Holes
* **Boat Ownership:** Players can eventually purchase their own vessels to bypass foot-only occupancy limits and reach deep-water fishing holes.
* **Operating Costs:** Owning a boat introduces recurring economic sinks, specifically maintenance fees and marina storage/docking costs.
* **Boat Upgrades:** Players can outfit their boats with advanced tech. 
  * *Example:* **Fishing Radar** – scans the current location and reveals the specific fish pools available in the immediate area.

### 4. Economy & Marketplace
* **Standard Merchant (NPC):** Buys standard fish at fixed, predictable baseline prices. Serves as the economic floor for the game.
* **Auction House (Player-to-Player):** A live market where players can auction rare fish, premium bait, or craftable materials. The system takes a small percentage-based transaction fee as an economic sink.
* **Trophy Wall:** Players can opt out of selling their rarest catches, instead mounting them on a personal, customizable Trophy Wall visible to visiting friends and competitors.

### 5. Live Operations & Events
* **Seasonal Fish:** Limited-time fish species rotate into the game based on real-world seasons or specific in-game events, driving short-term engagement and Auction House activity.
* **Tournaments (Future Roadmap):** Competitive fishing events based on weight, rarity, or quantity within a specific time limit.

---

## 6. Technical Requirements
* **Real-Time WebSockets:** Required for live spot occupancy, spot trading, and Auction House bids.
* **Database Management:** High-frequency transaction databases needed to handle dynamic pricing, inventory, and player-to-player spot handoffs.
* **Idle/Timeout Logic:** Strict session management to automatically free up occupancy slots if a player goes AFK or disconnects.

## 7. Next Steps
1. Finalize the core fishing mechanic prototype (tension/reel minigame).
2. Model the basic economy (Standard merchant payouts vs. Gear upgrade costs).
3. Develop the real-time server architecture for the 10-player dock occupancy test.
