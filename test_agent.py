import asyncio
from services.ai_agent.router_engine import app

async def run_test():
    print("=== RENTIVO LANGGRAPH INGYENES TESZT KÖR ===")
    
    # 1. TESZT: Karbantartás
    print("\n--- 1. Szcenárió: Karbantartás ---")
    state1 = {
        "user_input": "Ömlik a víz a fürdőben az APT-402-es lakásban, küldjetek valakit!",
        "property_id": "UNKNOWN", "category": "general", "requires_transaction": False, "verified_data": {}, "final_action": ""
    }
    res1 = await app.ainvoke(state1)
    print(f"Eredmény -> {res1['final_action']}")
    
    # 2. TESZT: Fizetés / Extra szolgáltatás
    print("\n--- 2. Szcenárió: Extra Szolgáltatás / Számlázás ---")
    state2 = {
        "user_input": "Szeretnék kérni egy extra takarítást holnapra az APT-105-be, küldjétek a számlát.",
        "property_id": "UNKNOWN", "category": "general", "requires_transaction": False, "verified_data": {}, "final_action": ""
    }
    res2 = await app.ainvoke(state2)
    print(f"Eredmény -> {res2['final_action']}")

if __name__ == "__main__":
    asyncio.run(run_test())
