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
      const prefix = gs.invoicePrefix !== undefined ? gs.invoicePrefix : 'INV-';
      const counter = Number(gs.invoiceCounter !== undefined ? gs.invoiceCounter : 1);
      const padding = Number(gs.invoicePadding !== undefined ? gs.invoicePadding : 6);
      
      const nextId = `${prefix}${String(counter).padStart(padding, '0')}`;
      
      // Increment and persist the counter immediately
      gs.invoicePrefix = prefix;
      gs.invoiceCounter = counter + 1;
      gs.invoicePadding = padding;
      await updateEntity('settings', 'global', { global_settings: gs });
      
      return nextId;
    } 
    else if (type === 'quotation') {
      const prefix = gs.quotationPrefix !== undefined ? gs.quotationPrefix : 'QT-';
      const counter = Number(gs.quotationCounter !== undefined ? gs.quotationCounter : 1);
      const padding = Number(gs.quotationPadding !== undefined ? gs.quotationPadding : 6);
      
      const nextId = `${prefix}${String(counter).padStart(padding, '0')}`;
      
      // Increment and persist the counter immediately
      gs.quotationPrefix = prefix;
      gs.quotationCounter = counter + 1;
      gs.quotationPadding = padding;
      await updateEntity('settings', 'global', { global_settings: gs });
      
      return nextId;
    }

    throw new Error(`Unsupported document type: ${type}`);
  }
}

module.exports = DocumentNumberService;
