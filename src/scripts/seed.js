require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wedplan';
    await mongoose.connect(mongoUri);
    console.log('[Seed]: Connected to MongoDB.');

    // Clear existing collections
    await User.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});
    await Transaction.deleteMany({});
    console.log('[Seed]: Cleared existing database records.');

    const defaultPassword = await bcrypt.hash('Password123', 10);

    // 1. Create Admin
    const admin = await User.create({
      name: 'WedPlan Administrator',
      email: 'admin@wedplan.com',
      password: defaultPassword,
      role: 'admin',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    // 2. Create Vendors
    const vendor1 = await User.create({
      name: 'Aurora Vance',
      email: 'aurora@wedplan.com',
      password: defaultPassword,
      role: 'vendor',
      businessName: 'Lumière Photo & Cinema Atelier',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    const vendor2 = await User.create({
      name: 'Sophia Laurent',
      email: 'sophia@wedplan.com',
      password: defaultPassword,
      role: 'vendor',
      businessName: 'Gretna Green Floral & Styling',
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    const vendor3 = await User.create({
      name: 'Marcus Sterling',
      email: 'marcus@wedplan.com',
      password: defaultPassword,
      role: 'vendor',
      businessName: 'Sterling Estate Venues & Gastronomy',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });

    // 3. Create Customers
    const customer1 = await User.create({
      name: 'Emily Hawthorne',
      email: 'emily@wedplan.com',
      password: defaultPassword,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
    });

    const customer2 = await User.create({
      name: 'Liam Gallagher',
      email: 'liam@wedplan.com',
      password: defaultPassword,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      isBlocked: false,
    });

    // 4. Create Wedding Services (Approved & Active)
    const services = [
      {
        vendorId: vendor1._id,
        serviceName: 'Fine Art Cinematic Wedding Photography',
        category: 'Photography & Videography',
        description:
          'Comprehensive all-day documentary and editorial wedding coverage. Includes two master photographers, drone aerial footage, 4K highlights film, high-resolution digital master gallery, and handcrafted Italian leather heirloom album.',
        price: 2450,
        location: 'New York, NY',
        images: [
          'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor3._id,
        serviceName: 'Villa Bellini Grand Estate & Ballroom Venue',
        category: 'Wedding Venues',
        description:
          'Nestled among rolling manicured vineyards, Villa Bellini offers an iconic Tuscan-style neoclassical banquet hall, private marble terrace, bridal luxury suite, and panoramic sunset views accommodating up to 350 distinguished guests.',
        price: 6800,
        location: 'Napa Valley, CA',
        images: [
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor2._id,
        serviceName: 'Enchanted Garden Botanical Floral Installation',
        category: 'Decoration & Florist',
        description:
          'Bespoke ethereal floral architecture featuring fresh garden peonies, Ecuadorian white roses, fragrant sweet peas, and cascading eucalyptus. Includes ceremony arch, bridal bouquet, bridesmaid posies, and centerpiece arrangements.',
        price: 1850,
        location: 'Savannah, GA',
        images: [
          'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor3._id,
        serviceName: 'Artisanal French Plated Wedding Banquet & Bar',
        category: 'Catering Services',
        description:
          'An unforgettable culinary journey curated by Michelin-trained chefs. Five-course plated menu featuring organic local produce, aged filet mignon, butter-poached Maine lobster, custom tiered patisserie wedding cake, and sommelier wine pairings.',
        price: 4200,
        location: 'San Francisco, CA',
        images: [
          'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor2._id,
        serviceName: 'Bridal Couture Glamour & Airbrush Styling',
        category: 'Makeup & Styling',
        description:
          'Luxury bridal hair and high-definition waterproof airbrush makeup artistry. Includes comprehensive bridal trial session, luxury skincare prep, lash extensions, and on-site touchups throughout the celebration.',
        price: 950,
        location: 'Miami, FL',
        images: [
          'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor1._id,
        serviceName: 'Custom Silk Crepe & French Lace Bridal Gown',
        category: 'Wedding Fashion',
        description:
          'Tailor-made haute couture bridal gown handcrafted from 100% mulberry silk crepe and Chantilly lace. Includes individual design sketches, bespoke toile fitting, custom veil, and personal dressmaker consultation.',
        price: 3200,
        location: 'Charleston, SC',
        images: [
          'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor1._id,
        serviceName: 'Romantic Sunset Drone & Cinema Storytelling',
        category: 'Photography & Videography',
        description:
          'Emotion-driven cinema storytelling capturing heartfelt vows, intimate glances, and energetic dancing. Delivered in 4K with licensed soundtrack and full-length ceremony edit.',
        price: 1950,
        location: 'Austin, TX',
        images: [
          'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor3._id,
        serviceName: 'Historic Glasshouse Conservatory Venue',
        category: 'Wedding Venues',
        description:
          'A breathtaking glass botanical conservatory built in 1912 with soaring ceilings, exotic palms, fairy light canopy, and climate-controlled elegance for winter or summer weddings.',
        price: 5400,
        location: 'Chicago, IL',
        images: [
          'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'approved',
        isActive: true,
      },
      {
        vendorId: vendor2._id,
        serviceName: 'Bohemian Pampas Grass & Rose Gold Decor',
        category: 'Decoration & Florist',
        description:
          'Chic boho styling combining bleached pampas grass, terracotta ceramics, blush velvet table runners, and gold geometric candlelight structures.',
        price: 1400,
        location: 'Scottsdale, AZ',
        images: [
          'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80',
        ],
        status: 'pending', // Pending service for admin review demo
        isActive: true,
      },
    ];

    const createdServices = await Service.insertMany(services);
    console.log(`[Seed]: Created ${createdServices.length} wedding services.`);

    // 5. Create Sample Bookings
    const booking1 = await Booking.create({
      serviceId: createdServices[0]._id,
      vendorId: vendor1._id,
      customerId: customer1._id,
      eventDate: '2026-10-15',
      eventLocation: 'Central Park Conservatory, NYC',
      message: 'Looking forward to booking your fine art photography for our autumn wedding ceremony!',
      status: 'Pending',
    });

    const booking2 = await Booking.create({
      serviceId: createdServices[1]._id,
      vendorId: vendor3._id,
      customerId: customer2._id,
      eventDate: '2026-08-22',
      eventLocation: 'Villa Bellini Estate, Napa Valley',
      message: 'We are expecting approximately 180 guests for our wedding dinner and reception.',
      status: 'Accepted',
    });

    const booking3 = await Booking.create({
      serviceId: createdServices[2]._id,
      vendorId: vendor2._id,
      customerId: customer1._id,
      eventDate: '2026-11-05',
      eventLocation: 'The DeSoto Ballroom, Savannah, GA',
      message: 'Would love to discuss custom flower choices matching our blush & sage palette.',
      status: 'Pending',
    });

    console.log('[Seed]: Created sample bookings.');

    // 6. Create Sample Transactions
    await Transaction.create([
      {
        vendorId: vendor1._id,
        plan: 'premium',
        amount: 49.0,
        currency: 'USD',
        stripeSessionId: 'cs_test_seed_lumiere_001',
        status: 'succeeded',
      },
      {
        vendorId: vendor3._id,
        plan: 'premium',
        amount: 49.0,
        currency: 'USD',
        stripeSessionId: 'cs_test_seed_sterling_002',
        status: 'succeeded',
      },
    ]);
    console.log('[Seed]: Created sample subscription transactions.');

    console.log('\n=========================================');
    console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY ');
    console.log('=========================================');
    console.log('ADMIN:    admin@wedplan.com    / Password123');
    console.log('VENDOR:   aurora@wedplan.com   / Password123 (Premium)');
    console.log('VENDOR:   sophia@wedplan.com   / Password123 (Free, 2 services)');
    console.log('VENDOR:   marcus@wedplan.com   / Password123 (Premium)');
    console.log('CUSTOMER: emily@wedplan.com    / Password123');
    console.log('CUSTOMER: liam@wedplan.com     / Password123');
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
