from openerp import models,api
from datetime import datetime
import time
from openerp.tools import DEFAULT_SERVER_DATETIME_FORMAT, DEFAULT_SERVER_DATE_FORMAT
from openerp.tools.float_utils import float_compare, float_round

 
class stock_delivery_labels(models.Model):
    _inherit = ['stock.picking']

    def transfer_stock_move_of_a_picking(self, cr, uid, picking_id, stock_move_id, product_qty, context=None):
        
        transfer_details_items_obj = self.pool.get('stock.transfer_details_items')
        transfer_details_obj = self.pool.get('stock.transfer_details')
        stock_move_obj = self.pool.get('stock.move')
        quant_obj = self.pool.get("stock.quant")
        stock_picking_obj = self.pool.get("stock.picking")
        
        ids = stock_move_id
        stock_move = stock_move_obj.browse(cr, uid,int(stock_move_id))
        picking = stock_picking_obj.browse(cr, uid,int(picking_id))
        product_qty = int(product_qty)
        
        if product_qty<stock_move.product_qty:
            
            transfer_details_id = transfer_details_obj.create(cr, uid, {'picking_id': int(picking_id)})
            transfer_details_items_id = transfer_details_items_obj.create(cr, uid, {    'transfer_id': transfer_details_id,
                                                                                        #'packop_id': int(stock_move_id),
                                                                                        'product_id': stock_move.product_id.id,
                                                                                        'product_uom_id': stock_move.product_uom.id,
                                                                                        'quantity': product_qty,
                                                                                        #'package_id': stock_move.package_id.id,
                                                                                        #'lot_id': stock_move.lot_id.id,
                                                                                        'sourceloc_id': stock_move.location_id.id,
                                                                                        'destinationloc_id': stock_move.location_dest_id.id,
                                                                                        #'result_package_id': stock_move.result_package_id.id,
                                                                                        'date': stock_move.date if stock_move.date else datetime.now(),
                                                                                        #'owner_id': stock_move.owner_id.id,
                                                                                        })

            transfer_details_obj.browse(cr, uid,transfer_details_id).do_detailed_transfer()
        
        elif product_qty==stock_move.product_qty:
            #Check for remaining qtys and unreserve/check move_dest_id in
            move_dest_ids = set()
            procurement_ids = set()
            for move in stock_move_obj.browse(cr, uid, ids, context=context):
                move_qty_cmp = float_compare(product_qty, 0, precision_rounding=move.product_id.uom_id.rounding)
                if move_qty_cmp > 0:  # (=In case no pack operations in picking)
                    main_domain = [('qty', '>', 0)]
                    prefered_domain = [('reservation_id', '=', move.id)]
                    fallback_domain = [('reservation_id', '=', False)]
                    fallback_domain2 = ['&', ('reservation_id', '!=', move.id), ('reservation_id', '!=', False)]
                    prefered_domain_list = [prefered_domain] + [fallback_domain] + [fallback_domain2]
                    stock_move_obj.check_tracking(cr, uid, move, move.restrict_lot_id.id, context=context)
                    qty = product_qty
                    quants = quant_obj.quants_get_prefered_domain(cr, uid, move.location_id, move.product_id, qty, domain=main_domain, prefered_domain_list=prefered_domain_list, restrict_lot_id=move.restrict_lot_id.id, restrict_partner_id=move.restrict_partner_id.id, context=context)
                    quant_obj.quants_move(cr, uid, quants, move, move.location_dest_id, lot_id=move.restrict_lot_id.id, owner_id=move.restrict_partner_id.id, context=context)

                # If the move has a destination, add it to the list to reserve
                if move.move_dest_id and move.move_dest_id.state in ('waiting', 'confirmed'):
                    move_dest_ids.add(move.move_dest_id.id)

                if move.procurement_id:
                    procurement_ids.add(move.procurement_id.id)

                #unreserve the quants and make them available for other operations/moves
                quant_obj.quants_unreserve(cr, uid, move, context=context)
            # Check the packages have been placed in the correct locations
            stock_move_obj._check_package_from_moves(cr, uid, ids, context=context)
            #set the move as done
            stock_move_obj.write(cr, uid, ids, {'state': 'done', 'date': time.strftime(DEFAULT_SERVER_DATETIME_FORMAT)}, context=context)
            self.pool.get('procurement.order').check(cr, uid, list(procurement_ids), context=context)
            #assign destination moves
            if move_dest_ids:
                stock_move_obj.action_assign(cr, uid, list(move_dest_ids), context=context)
                
            #check if all moves are done, than done the picking
            done = True
            for move in picking.move_lines:
                if move.state != 'done':
                    done = False
                    break
            if done:
                stock_picking_obj.write(cr, uid, picking.id, {'state':'done','date_done': time.strftime(DEFAULT_SERVER_DATETIME_FORMAT)}, context=context)
        
        return True
        
    def create_backorder(self, cr, uid, ids, context={}):
        picking = self.pool.get("stock.picking").browse(cr, uid, ids)
        #check if all moves are done, than done the picking
        ok = False
        for move in picking.move_lines:
            if move.state == 'done':
                ok = True
                break
        if ok:
            self.pool.get("stock.picking")._create_backorder(cr, uid, picking, context=context)
        else:
            return {'warning': {'title': 'Backorder Creation Failure', 'message': 'You need at least a finished product line to create a backorder'},}

        return True