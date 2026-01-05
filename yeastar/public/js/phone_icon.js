// Copyright (c) 2025, HALFWARE
// License: GNU General Public License v3. See license.txt

// phone_icon.js - insert call icon visually inside input (right side)
// Compatible Frappe / ERPNext v15


/**
 * Applique l'icône d'appel à un champ donné sur un formulaire Frappe.
 * Cette fonction contient la logique de validation et l'appel à l'API Yeastar.
 * * @param {object} frm - L'objet Formulaire (cur_frm).
 * @param {string} fieldname - Le nom du champ cible (ex: 'mobile_no').
 */
function apply_call_icon(frm, fieldname) {
    // Éviter d'appliquer l'icône sur les vues qui ne sont pas des formulaires ou si le champ n'existe pas
    if (!frm || !frm.fields_dict[fieldname]) {
        return;
    }

    const phone_value = frm.doc[fieldname];

    if (phone_value) {
        // Nettoyage de la valeur : conserver seulement les chiffres et le signe '+'
        const cleaned_phone = phone_value.replace(/[^0-9+]/g, ''); 
        // Validation : au moins 9 chiffres
        const numeric_part = cleaned_phone.replace(/[^0-9]/g, '');

        if (numeric_part.length >= 9) {
            const field_element = frm.fields_dict[fieldname].$wrapper;

            // Vérifier si l'icône n'est pas déjà présente
            if (field_element.find('.call-icon-link').length === 0) {

                // Fonction d'appel de l'API Yeastar
                const make_call = () => {
                    frappe.call({
                        method: 'yeastar.api.make_call', // Votre API Python Whitelisted
                        args: {
                            phone_number: cleaned_phone
                        },
                        callback: function(r) {
                            if (r.message) {
                                frappe.msgprint(__('Appel initié vers ') + cleaned_phone + '. ' + r.message, __("Succès"));
                            } else {
                                frappe.msgprint({
                                    title: __('Erreur d\'appel'),
                                    message: __('Impossible d\'initier l\'appel. Veuillez vérifier la configuration Yeastar.'),
                                    indicator: 'red'
                                });
                            }
                        }
                    });
                };

                // Créer le lien avec l'icône Font Awesome
                const call_icon_html = `
                    <a href="#" 
                       class="call-icon-link" 
                       onclick="return false;"
                       data-phone="${cleaned_phone}"
                       title="${__('Cliquez pour appeler :')} ${phone_value}"
                       style="position: absolute;left: 150px;bottom: 4px;">
                        <i class="fa fa-phone" style="margin-left: 5px; cursor: pointer; color:blue"></i>
                    </a>
                `;

                // Cibler l'endroit où insérer l'icône
                //const static_value_element = field_element.find('.static-value') || field_element.find('.like-disabled-input');
                const static_value_element = field_element.find('.like-disabled-input:visible');

                if (static_value_element.length) {
                    // Pour les champs Read-Only
                    static_value_element.append(call_icon_html); 
                    field_element.find('.call-icon-link').on('click', make_call);
                } else {
                    // Pour les champs Editables (souvent sans .static-value)
                    field_element.find('.control-input').append(call_icon_html);
                    field_element.find('.call-icon-link').on('click', make_call);
                }
            }
        }
    }
}

frappe.ui.form.on('Contact', {
    refresh: function(frm) {
        apply_call_icon(frm, 'mobile_no');
        apply_call_icon(frm, 'phone');
    }
});

frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        apply_call_icon(frm, 'mobile_no');
        apply_call_icon(frm, 'phone');
        apply_call_icon(frm, 'phone_ext');
    }
});

frappe.ui.form.on('Address', {
    refresh: function(frm) {
        apply_call_icon(frm, 'phone');
    }
});

frappe.ui.form.on('Customer', {
    refresh: function(frm) {
        frm.add_custom_button(__('Call'), function() {
           frappe.call({
                method: 'yeastar.api.get_customer_phones',
                args: {
                    customer_name: frm.doc.name
                },
                callback: (r) => {
                    show_phone_selection_dialog(frm, r.message);
                }
            });
        }, 'Actions');

        if (frm.fields_dict.main_contact_phone && frm.fields_dict.main_contact_phone.$wrapper.find('.call-icon-link').length) {
            frm.fields_dict.main_contact_phone.$wrapper.find('.call-icon-link').remove();
        }
    }
});

function show_phone_selection_dialog(frm, phone_options) {
    const fields = [
        {
            label: __('Select the number'),
            fieldname: 'phone_to_call',
            fieldtype: 'Select',
            options: phone_options.map(p => `${p.number} - ${p.label}`),
            reqd: 1
        }
    ];

    const dialog = new frappe.ui.Dialog({
        title: __('Start a call'),
        fields: fields,
        primary_action_label: __('Call'),
        primary_action: function(data) {
            const selected_string = data.phone_to_call;
            const phone_number = selected_string.split(' - ')[0].trim();

            if (phone_number) {
                frappe.call({
                    method: 'yeastar.api.make_call',
                    args: {
                        phone_number: phone_number
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(r.message, __('Succes Call'));
                        }
                    }
                });
                dialog.hide();
            } else {
                frappe.msgprint(__('Invalide Phone Number.'), __('Error'));
            }
        }
    });
    dialog.show();
}

frappe.ui.form.on('Supplier', { refresh: function(frm) { apply_call_icon(frm, 'phone'); } });
