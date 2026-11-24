import dns from 'dns';
import mongoose from 'mongoose';
import { ENV } from '../config/env';
import { User } from '../modules/users/user.model';
import { Retailer } from '../modules/retailers/retailer.model';
import { Order } from '../modules/orders/order.model';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // ignore
}

async function testConnection(uri: string, name: string) {
  console.log(`\n=== Checking Connection for: ${name} ===`);
  try {
    const conn = await mongoose.connect(uri, {
      dbName: ENV.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ SUCCESS: Connected to database "${conn.connection.name}"!`);

    const usersCount = await User.countDocuments();
    const retailersCount = await Retailer.countDocuments();
    const ordersCount = await Order.countDocuments();

    console.log(`Counts -> Users: ${usersCount}, Retailers: ${retailersCount}, Orders: ${ordersCount}`);

    const retailers = await Retailer.find().select('businessName contactPerson email phone customerType isActive').lean();
    console.log('Existing Retailers:');
    retailers.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r._id}] ${r.businessName} (${r.contactPerson}) - ${r.phone} / ${r.email}`);
    });

    await mongoose.disconnect();
  } catch (err: any) {
    console.error(`❌ Connection failed for ${name}: ${err.message}`);
  }
}

async function main() {
  await testConnection(ENV.MONGODB_URI, `Configured Database (${ENV.MONGODB_DB_NAME})`);
}

main().catch(console.error);

main().catch(console.error);
