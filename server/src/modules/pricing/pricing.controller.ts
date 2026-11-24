import { Request, Response, NextFunction } from 'express';
import { pricingService } from './pricing.service';
import {
  createPricingGroupSchema,
  updatePricingGroupSchema,
  createProductPricingRuleSchema,
  updateProductPricingRuleSchema,
} from '@necessity/shared';
import { ApiError } from '../../utils/api-error';

export class PricingController {
  // ==========================================
  // PRICING GROUPS
  // ==========================================

  static async getGroups(req: Request, res: Response, Next: NextFunction) {
    try {
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const customerType = req.query.customerType ? String(req.query.customerType) : undefined;
      const groups = await pricingService.getPricingGroups({ isActive, customerType });
      res.json({ success: true, data: groups });
    } catch (err) {
      Next(err);
    }
  }

  static async getGroupById(req: Request, res: Response, Next: NextFunction) {
    try {
      const group = await pricingService.getPricingGroupById(req.params.id);
      res.json({ success: true, data: group });
    } catch (err) {
      Next(err);
    }
  }

  static async createGroup(req: Request, res: Response, Next: NextFunction) {
    try {
      const validated = createPricingGroupSchema.parse(req.body);
      const group = await pricingService.createPricingGroup(validated);
      res.status(201).json({ success: true, data: group, message: 'Pricing group created successfully' });
    } catch (err) {
      Next(err);
    }
  }

  static async updateGroup(req: Request, res: Response, Next: NextFunction) {
    try {
      const validated = updatePricingGroupSchema.parse(req.body);
      const group = await pricingService.updatePricingGroup(req.params.id, validated);
      res.json({ success: true, data: group, message: 'Pricing group updated successfully' });
    } catch (err) {
      Next(err);
    }
  }

  static async deleteGroup(req: Request, res: Response, Next: NextFunction) {
    try {
      const result = await pricingService.deletePricingGroup(req.params.id);
      res.json({ success: true, message: result.message });
    } catch (err) {
      Next(err);
    }
  }

  // ==========================================
  // PRICING RULES
  // ==========================================

  static async getRules(req: Request, res: Response, Next: NextFunction) {
    try {
      const { productId, pricingGroupId, retailerId, customerType } = req.query;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

      const rules = await pricingService.getPricingRules({
        productId: productId ? String(productId) : undefined,
        pricingGroupId: pricingGroupId ? String(pricingGroupId) : undefined,
        retailerId: retailerId ? String(retailerId) : undefined,
        customerType: customerType ? String(customerType) : undefined,
        isActive,
      });

      res.json({ success: true, data: rules });
    } catch (err) {
      Next(err);
    }
  }

  static async getRuleById(req: Request, res: Response, Next: NextFunction) {
    try {
      const rule = await pricingService.getPricingRuleById(req.params.id);
      res.json({ success: true, data: rule });
    } catch (err) {
      Next(err);
    }
  }

  static async createRule(req: Request, res: Response, Next: NextFunction) {
    try {
      const validated = createProductPricingRuleSchema.parse(req.body);
      const rule = await pricingService.createPricingRule({
        ...validated,
        variantId: validated.variantId || undefined,
        pricingGroupId: validated.pricingGroupId || undefined,
        retailerId: validated.retailerId || undefined,
        customerType: validated.customerType || undefined,
        customPricePaise: validated.customPricePaise || undefined,
        discountPercent: validated.discountPercent || undefined,
        minOrderQuantity: validated.minOrderQuantity || undefined,
      });
      res.status(201).json({ success: true, data: rule, message: 'Pricing rule created successfully' });
    } catch (err) {
      Next(err);
    }
  }

  static async updateRule(req: Request, res: Response, Next: NextFunction) {
    try {
      const validated = updateProductPricingRuleSchema.parse(req.body);
      const rule = await pricingService.updatePricingRule(req.params.id, {
        ...validated,
        customPricePaise: validated.customPricePaise || undefined,
        discountPercent: validated.discountPercent || undefined,
        minOrderQuantity: validated.minOrderQuantity || undefined,
      });
      res.json({ success: true, data: rule, message: 'Pricing rule updated successfully' });
    } catch (err) {
      Next(err);
    }
  }

  static async deleteRule(req: Request, res: Response, Next: NextFunction) {
    try {
      const result = await pricingService.deletePricingRule(req.params.id);
      res.json({ success: true, message: result.message });
    } catch (err) {
      Next(err);
    }
  }

  // ==========================================
  // RESOLVE ITEM PRICE
  // ==========================================

  static async calculatePrice(req: Request, res: Response, Next: NextFunction) {
    try {
      const { productId, variantId, quantity, retailerId, customerType, pricingGroupId } = req.body;
      if (!productId) {
        throw ApiError.badRequest('productId is required');
      }

      const result = await pricingService.resolveProductPrice({
        productId,
        variantId,
        quantity: Number(quantity) || 1,
        retailerId,
        customerType,
        pricingGroupId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      Next(err);
    }
  }
}

