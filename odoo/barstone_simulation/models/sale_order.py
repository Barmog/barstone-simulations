from odoo import _, models
from odoo.exceptions import UserError


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def action_open_barstone_simulation(self):
        """פותח את מערכת ההדמיות בלשונית חדשה, עם מזהה ההזמנה."""
        self.ensure_one()
        base = (self.env["ir.config_parameter"].sudo().get_param("barstone.simulation_url") or "").strip()
        if not base:
            raise UserError(_("חסר פרמטר המערכת barstone.simulation_url (כתובת מערכת ההדמיות)."))
        sep = "&" if "?" in base else "?"
        return {"type": "ir.actions.act_url", "url": "%s%sodoo=%s" % (base, sep, self.id), "target": "new"}
