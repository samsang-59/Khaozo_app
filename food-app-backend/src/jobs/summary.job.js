// AI one-line dish summary (every summary_refresh_every new text reviews).
import * as menuItemService from '../services/menuItem.service.js';

export default async ({ menuItemId }) => (await menuItemService.refreshSummaryIfDue(menuItemId)).data;
