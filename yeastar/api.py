import frappe
import requests
import json
from frappe import _

def get_pbx_settings():
    settings = {}
    try:
        pbx_ext = frappe.get_doc('PBX Extension', {'user': frappe.session.user})
        settings["caller_ext"] = pbx_ext.extension  # Caller Extention
    except Exception as e:
        frappe.log_error(f"Errrot in Yeastar Extension: {e}", "Extension Config Error")
        frappe.throw(_("Please fix values in 'PBX Extension'."))

    try:
        pbx = frappe.get_doc("PBX Settings")
        settings["pbx_url"] = pbx.url
        settings["pbx_port"] = pbx.port or "8088" # Default API HTTP Port
        settings["pbx_token"] = pbx.token # API Key
        return settings
    except Exception as e:
        frappe.log_error(f"Errrot in Yeastar Settings: {e}", "Yeastar Config Error")
        frappe.throw(_("Please fix values in 'Yeastar Settings'."))


@frappe.whitelist()
def make_call(phone_number):
    if not phone_number:
        frappe.throw(_("No phone number."))

    #cleaned_number = "".join(filter(str.isdigit, phone_number.replace('+', '')))
    cleaned_number = "".join(filter(lambda x: x.isdigit() or x == '+', phone_number))

    if len(cleaned_number) < 9:
        frappe.throw(_("Invalid Number"))

    settings = get_pbx_settings()

    caller_ext = settings.get("caller_ext", "101")

    url = f"http://{settings['pbx_url']}:{settings['pbx_port']}/api/v1/call/originate"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings['pbx_token']}" 
    }

    payload = {
        "extension": caller_ext,
        "exten_to": cleaned_number,
        "account_id": caller_ext
    }

    frappe.logger("yeastar").info(f"Yeastar API Call: {url}, Payload: {payload}")

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=15)
        response.raise_for_status()

        response_json = response.json()

        if response_json.get("code") == 0 and response_json.get("status") == "success":
            return _("Succeful initaited call to ") + cleaned_number + _(". Your number is ") + caller_ext + _(" will RING.")
        else:
            error_message = response_json.get("message", _("Error PBX. Code: ") + str(response_json.get("code")))
            frappe.throw(_(f"Failed initiated call : {error_message}"))

    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Connexion Error to PBX: {e}", "Yeastar API Connection Error")
        frappe.throw(_("Connexion Failed to PBX Yeastar. Verify your setttings."))
    except frappe.exceptions.ValidationError:
        raise
    except Exception as e:
        frappe.log_error(f"Error : {e}", "Yeastar General Error")
        frappe.throw(_("Unwanted error will calling."))


@frappe.whitelist()
def get_customer_phones(customer_name):
    if not customer_name:
        return []

    phone_options = []
    
    link_filter = [
        ['link_doctype', '=', 'Customer'],
        ['link_name', '=', customer_name]
    ]
    
    linked_contact_names = frappe.get_list('Dynamic Link',
        filters={'link_doctype': 'Customer', 'link_name': customer_name, 'parenttype': 'Contact'},
        fields=['parent']
    )
    
    contact_names = [d.parent for d in linked_contact_names]
    
    if contact_names:
        contacts = frappe.get_list('Contact', 
            filters={'name': ['in', contact_names]},
            fields=['name', 'first_name', 'last_name', 'phone', 'mobile_no'])
        
        for contact in contacts:
            contact_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or contact.name
            
            if contact.phone and len("".join(filter(str.isdigit, contact.phone))) >= 9:
                phone_options.append({
                    "number": contact.phone,
                    "label": f"Contact: {contact_name} (Fixe)"
                })
                
            if contact.mobile_no and len("".join(filter(str.isdigit, contact.mobile_no))) >= 9:
                phone_options.append({
                    "number": contact.mobile_no,
                    "label": f"Contact: {contact_name} (Mobile)"
                })


    linked_address_names = frappe.get_list('Dynamic Link',
        filters={'link_doctype': 'Customer', 'link_name': customer_name, 'parenttype': 'Address'},
        fields=['parent']
    )
    
    address_names = [d.parent for d in linked_address_names]
    
    if address_names:
        addresses = frappe.get_list('Address', 
            filters={'name': ['in', address_names]},
            fields=['name', 'address_title', 'phone'])

        for address in addresses:
            if address.phone and len("".join(filter(str.isdigit, address.phone))) >= 9:
                phone_options.append({
                    "number": address.phone,
                    "label": f"Adresse: {address.address_title or address.name}"
                })
            
    unique_options = {}
    for item in phone_options:
        clean_key = "".join(filter(str.isdigit, item['number'].replace('+', '')))
        if clean_key not in unique_options:
            unique_options[clean_key] = item
            
    return list(unique_options.values())
