import csv
import os
from itertools import combinations
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

# --- Global Databases (Loaded at startup) ---
COMPONENT_DB = {}
INTERACTION_DB = {}
ALL_DRUG_DISPLAY_NAMES = []

def load_databases():
    global COMPONENT_DB, INTERACTION_DB, ALL_DRUG_DISPLAY_NAMES
    
    # Pathing logic to find CSVs in the root folder
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Load drugs.csv
    try:
        with open(os.path.join(base_path, 'drugs.csv'), mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
            for row in reader:
                key = row['brand_name'].strip().lower().replace(' ', '_')
                salts = [s.strip() for s in row['component_salts'].split('|')]
                quantities = [q.strip() for q in row['component_quantities'].split('|')]
                COMPONENT_DB[key] = {
                    "key_name": key,
                    "brand_name": row['brand_name'].strip(),
                    "display_name": row['brand_name'].strip(),
                    "salts": salts,
                    "quantities": quantities
                }
            ALL_DRUG_DISPLAY_NAMES = sorted([info["display_name"] for info in COMPONENT_DB.values()])
    except Exception as e:
        print(f"Error loading drugs: {e}")

    # Load interactions.csv
    try:
        with open(os.path.join(base_path, 'interactions.csv'), mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
            for row in reader:
                salt_a, salt_b = row['salt_a'].strip(), row['salt_b'].strip()
                interaction_key = tuple(sorted((salt_a, salt_b)))
                INTERACTION_DB[interaction_key] = {
                    "pair": f"{salt_a} + {salt_b}",
                    "effect": row['effect'].strip(),
                    "severity": row['severity'].strip().capitalize()
                }
    except Exception as e:
        print(f"Error loading interactions: {e}")

# Call loader immediately when module is imported
load_databases()

# --- View Endpoints ---

def get_all_drugs(request):
    display_name_to_key = {info["display_name"]: key for key, info in COMPONENT_DB.items()}
    return JsonResponse({
        "all_drugs": ALL_DRUG_DISPLAY_NAMES,
        "name_to_key_map": display_name_to_key
    })

@csrf_exempt # Required for POST requests from the frontend
def check_interactions(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        data = json.loads(request.body)
        selected_drug_keys = data.get('drugs', [])
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if len(selected_drug_keys) < 2:
        return JsonResponse({"interactions": [], "components": []})

    all_salts = set()
    component_details_list = []
    
    for key in selected_drug_keys:
        if key in COMPONENT_DB:
            drug_info = COMPONENT_DB[key]
            components_with_quantities = [
                {"name": salt, "quantity": drug_info['quantities'][i] if i < len(drug_info['quantities']) else 'N/A'}
                for i, salt in enumerate(drug_info['salts'])
            ]
            component_details_list.append({
                "name": drug_info["display_name"],
                "brandName": drug_info["brand_name"],
                "components": components_with_quantities
            })
            all_salts.update(drug_info['salts'])

    interactions = []
    for salt_a, salt_b in combinations(all_salts, 2):
        key = tuple(sorted((salt_a, salt_b)))
        if key in INTERACTION_DB:
            interactions.append(INTERACTION_DB[key])

    return JsonResponse({
        "interactions": interactions,
        "components": component_details_list
    })