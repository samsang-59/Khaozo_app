import * as metaService from '../services/meta.service.js';
import { sendResult } from '../utils/reasons.js';

export const areas = async (req, res) => sendResult(res, await metaService.areas());
export const cuisines = async (req, res) => sendResult(res, await metaService.cuisines());
export const dishCategories = async (req, res) => sendResult(res, await metaService.dishCategories());
export const mainIngredients = async (req, res) => sendResult(res, await metaService.mainIngredients());
export const tags = async (req, res) => sendResult(res, await metaService.tags());
