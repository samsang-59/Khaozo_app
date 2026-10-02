import { Router } from 'express';
import * as metaController from '../controllers/meta.controller.js';

const router = Router();

// 🌐 lookup lists (cached 24 h)
router.get('/areas', metaController.areas);
router.get('/cuisines', metaController.cuisines);
router.get('/dish-categories', metaController.dishCategories);
router.get('/main-ingredients', metaController.mainIngredients);
router.get('/tags', metaController.tags);

export default router;
