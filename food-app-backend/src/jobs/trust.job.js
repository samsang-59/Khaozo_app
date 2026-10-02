// Nightly: recalculate every user's trust score.
import * as trustService from '../services/helpers/trust.js';

export default async () => trustService.recalculateAll();
