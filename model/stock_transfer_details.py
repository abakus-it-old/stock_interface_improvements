from openerp import models,api
 
class stock_delivery_labels(models.Model):
    _inherit = ['stock.picking']

    def transfer_pack_operations(self, cr, uid, picking_id, pack_operations, context=None):
        return self.pool.get('stock.pack.operation')._search_and_increment(cr, uid, picking_id, [('product_id', '=', product_id),('id', '=', op_id)], increment=increment, context=context)