import os
from typing import Dict, TypedDict, Literal
from pydantic import BaseModel
import httpx
import stripe
import re
from langgraph.graph import StateGraph, END

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

class AgentState(TypedDict):
    user_input: str
    property_id: str
    category: str
    requires_transaction: bool
    detected_service: str  # ÚJ: az észlelt szolgáltatás kulcsszava
    verified_data: dict
    final_action: str

async def intent_router_node(state: AgentState) -> Dict:
    text = state["user_input"].lower()
    category = "general"
    requires_transaction = False
    property_id = "UNKNOWN"
    detected_service = "unknown"
    
    # Ingatlan ID kinyerése
    match = re.search(r'[a-zA-Z]+-\d+', state["user_input"])
    if match:
        property_id = match.group(0).upper()
        
    # Szolgáltatás és szándék felismerés
    if any(sz in text for sz in ["csőtörés", "víz", "dugulás", "zár", "ajtó", "törött"]):
        category = "maintenance"
    elif any(sz in text for sz in ["számla", "fizetés", "takarítás", "pótdíj", "fizetni", "parkolás", "klíma"]):
        category = "billing"
        requires_transaction = True
        
        # Kulcsszó detektálás az adatbázishoz
        if "takarít" in text:
            detected_service = "takarítás"
        elif "parkol" in text:
            detected_service = "parkolás"
        elif "klíma" in text or "klima" in text:
            detected_service = "klíma"
        
    return {
        "category": category, 
        "requires_transaction": requires_transaction, 
        "property_id": property_id,
        "detected_service": detected_service
    }

async def database_verification_node(state: AgentState) -> Dict:
    if state["property_id"] == "UNKNOWN":
        return {"verified_data": {"is_active": False, "error": "Hiányzó ingatlan azonosító"}}
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    # Fallback ha nincs DB kulcs
    if not supabase_url or not supabase_key:
        return {
            "verified_data": {
                "is_active": True, 
                "owner_id": "cus_MOCK_123", 
                "service_name": "Teszt Szolgáltatás", 
                "price_huf": 12000
            }
        }

    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
    verified_res = {"is_active": False, "owner_id": "UNKNOWN", "service_name": "Általános díj", "price_huf": 5000}
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Ingatlan ellenőrzése
            prop_url = f"{supabase_url}/rest/v1/properties?property_code=eq.{state['property_id']}&select=is_active,owner_id"
            prop_resp = await client.get(prop_url, headers=headers)
            prop_data = prop_resp.json()
            
            if prop_resp.status_code == 200 and prop_data:
                verified_res["is_active"] = prop_data[0]["is_active"]
                verified_res["owner_id"] = prop_data[0]["owner_id"]
            else:
                return {"verified_data": {"is_active": False, "error": "Az ingatlan nem létezik."}}
                
            # 2. Dinamikus Ár lekérése a services táblából
            if state["requires_transaction"] and state["detected_service"] != "unknown":
                srv_url = f"{supabase_url}/rest/v1/services?service_keyword=eq.{state['detected_service']}&select=service_name,price_huf"
                srv_resp = await client.get(srv_url, headers=headers)
                srv_data = srv_resp.json()
                
                if srv_resp.status_code == 200 and srv_data:
                    verified_res["service_name"] = srv_data[0]["service_name"]
                    verified_res["price_huf"] = srv_data[0]["price_huf"]
                    
        return {"verified_data": verified_res}
    except Exception as e:
        return {"verified_data": {"is_active": False, "error": f"DB hiba: {str(e)}"}}

async def execution_node(state: AgentState) -> Dict:
    v_data = state["verified_data"]
    
    if not v_data.get("is_active"):
        return {"final_action": f"MŰVELET MEGSZAKÍTVA: {v_data.get('error', 'Inaktív ingatlan')}"}

    if state["requires_transaction"]:
        # Fallback ha nincs Stripe kulcs
        if not stripe.api_key or "a_te_stripe" in stripe.api_key:
            return {"final_action": f"STRIPE MOCK: {v_data['service_name']} ({v_data['price_huf']} Ft) link generálva."}
        
        try:
            # ÉLES FINTECH FUTAM: Dinamikus adatok az adatbázisból, *100 a fillérek miatt!
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'huf',
                        'product_data': {'name': f"{v_data['service_name']} - {state['property_id']}"},
                        'unit_amount': int(v_data['price_huf']) * 100, 
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url='https://rentivo.com/success',
                cancel_url='https://rentivo.com/cancel',
            )
            return {"final_action": f"FINTECH SIKER ({v_data['price_huf']} Ft): Link -> {session.url}"}
        except Exception as e:
            return {"final_action": f"Stripe API Hiba: {str(e)}"}
            
    elif state["category"] == "maintenance":
        return {"final_action": f"DISZPÉCSER RIASZTVA az '{state['property_id']}' lakáshoz."}
    
    return {"final_action": "Általános jegy rögzítve."}

# Gráf felépítése az új állapottal
workflow = StateGraph(AgentState)
workflow.add_node("router", intent_router_node)
workflow.add_node("verifier", database_verification_node)
workflow.add_node("executor", execution_node)
workflow.set_entry_point("router")
workflow.add_conditional_edges("router", lambda state: "verify" if state["category"] in ["maintenance", "billing"] else "end", {"verify": "verifier", "end": END})
workflow.add_edge("verifier", "executor")
workflow.add_edge("executor", END)
app = workflow.compile()
