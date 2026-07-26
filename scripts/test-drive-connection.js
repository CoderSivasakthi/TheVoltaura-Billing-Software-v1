#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// Test Google Drive connection and folder structure
// Run: node scripts/test-drive-connection.js
// ─────────────────────────────────────────────────────────────────────
require('dotenv').config();

const GoogleDriveService = require('../backend/services/GoogleDriveService');

async function main() {
  console.log('\n🔍 Testing Google Drive Connection...\n');

  if (!GoogleDriveService.isDriveConfigured()) {
    console.error('❌ Google Drive is NOT configured.');
    console.error('   Please add these to your .env file:');
    console.error('   - GOOGLE_SERVICE_ACCOUNT_EMAIL');
    console.error('   - GOOGLE_PRIVATE_KEY');
    console.error('   - GOOGLE_DRIVE_ROOT_FOLDER_ID');
    process.exit(1);
  }

  console.log('✅ Credentials found in .env\n');

  // Test connection
  const result = await GoogleDriveService.testConnection();
  if (!result.ok) {
    console.error('❌ Connection FAILED:', result.message);
    console.error('\nCommon fixes:');
    console.error('  1. Make sure the Root Folder is shared with your service account email as Editor');
    console.error('  2. Verify the GOOGLE_DRIVE_ROOT_FOLDER_ID is correct');
    console.error('  3. Check that the Google Drive API is enabled in Google Cloud Console');
    process.exit(1);
  }

  console.log('✅ Connected to Google Drive!');
  console.log(`   Root Folder: "${result.folderName}" (${result.folderId})\n`);

  // Test folder creation
  console.log('📁 Initializing root folder structure...');
  const rootFolders = await GoogleDriveService.initializeRootFolders();
  if (rootFolders) {
    console.log('✅ Root folders created/verified:');
    console.log(`   📂 Customers: ${rootFolders.customers}`);
    console.log(`   📂 Company:   ${rootFolders.company}`);
    console.log(`   📂 Templates: ${rootFolders.templates}`);
    console.log(`   📂 Reports:   ${rootFolders.reports}`);
    console.log(`   📂 Backup:    ${rootFolders.backup}`);
  }

  // Test customer folder creation
  console.log('\n📁 Testing customer folder creation (TEST-000001)...');
  const customerFolders = await GoogleDriveService.createCustomerFolders('TEST-000001');
  console.log('✅ Customer folders created:');
  Object.entries(customerFolders).forEach(([key, id]) => {
    console.log(`   📂 ${key}: ${id}`);
  });

  console.log('\n✅ All tests passed! Google Drive is ready.\n');
  console.log('📌 Next steps:');
  console.log('  1. Run scripts/supabase-schema-v2.sql in your Supabase SQL Editor');
  console.log('  2. Restart your backend: npm start');
  console.log('  3. New customers will automatically get Drive folder trees');
}

main().catch(e => {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
});
