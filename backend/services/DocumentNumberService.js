/**
 * DocumentNumberService
 * 
 * Centralized service to handle dynamic document numbering.
 * This service ensures that document numbers (Invoices, Quotations) are generated 
 * consistently according to the prefixes configured in the Settings.
 * 
 * It reads the current configuration, throws an error if it hasn't been set up,
 * increments the internal counter, and returns the newly generated document ID.
 */

class DocumentNumberService {
  /**
   * Generates the next sequential ID for the given document type.
   * 
   * @param {string} type - 'invoice' or 'quotation'
   * @param {object} listEntities - Function to list entities (for reading settings)
   * @param {object} updateEntity - Function to update an entity (for saving settings)
   * @returns {string} The fully formatted document ID
   * @throws {Error} If the prefix configuration is missing
   */
  static async generateNextId(type, listEntities, updateEntity) {
    const settingsList = await listEntities('settings');
    const globalSettings = settingsList.find(s => s.id === 'global') || { id: 'global', global_settings: {} };
    const gs = globalSettings.global_settings || {};

    if (type === 'invoice') {
      if (gs.invoicePrefix !== undefined && gs.invoiceCounter !== undefined && gs.invoicePadding !== undefined) {
        const counter = Number(gs.invoiceCounter);
        const padding = Number(gs.invoicePadding);
        const prefix = gs.invoicePrefix;
        const nextId = `${prefix}${String(counter).padStart(padding, '0')}`;
        
        // Increment and persist the counter immediately
        gs.invoiceCounter = counter + 1;
        await updateEntity('settings', 'global', { global_settings: gs });
        
        return nextId;
      } else {
        throw new Error('Document numbering has not been configured. Please configure Invoice Prefix in Settings before creating documents.');
      }
    } 
    else if (type === 'quotation') {
      if (gs.quotationPrefix !== undefined && gs.quotationCounter !== undefined && gs.quotationPadding !== undefined) {
        const counter = Number(gs.quotationCounter);
        const padding = Number(gs.quotationPadding);
        const prefix = gs.quotationPrefix;
        const nextId = `${prefix}${String(counter).padStart(padding, '0')}`;
        
        // Increment and persist the counter immediately
        gs.quotationCounter = counter + 1;
        await updateEntity('settings', 'global', { global_settings: gs });
        
        return nextId;
      } else {
        throw new Error('Document numbering has not been configured. Please configure Quotation Prefix in Settings before creating documents.');
      }
    }

    throw new Error(`Unsupported document type: ${type}`);
  }
}

module.exports = DocumentNumberService;
