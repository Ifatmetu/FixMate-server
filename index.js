import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import multer from 'multer';
dns.setServers(['8.8.8.8', '1.1.1.1']);


const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


const upload = multer({
  storage: multer.memoryStorage(),
});

// ===============================
// MongoDB Connection
// ===============================

const client = new MongoClient(
  `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASSWORD}@cluster0.nutiwnu.mongodb.net/`
);

export async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("You successfully connected to MongoDB!");

    return client;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}


// ===============================
// Database & Collections
// ===============================

const connectedClient = await connectToMongoDB();

const database = connectedClient.db("FixMate");

const users = database.collection("users");
const services = database.collection("services");
const bookings = database.collection("bookings");
const payments = database.collection("payments");


// ===============================
// Test Route
// ===============================

app.get('/', (req, res) => {
  res.send('FixMate Server is running!');
});


// ===============================
// Users
// ===============================

app.get('/users', async (req, res) => {
  try {
    const result = await users.find({}).toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

app.post('/users', async (req, res) => {
  try {
    const user = req.body;

    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      return res.status(400).send({
        success: false,
        message: "Invalid user data",
      });
    }

    const newUser = {
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    res.status(201).send({
      success: true,
      message: "User added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to add user:", error);
    res.status(500).send({
      success: false,
      message: "Failed to add user",
    });
  }
});


// ===============================
// Services
// ===============================

app.get('/services', async (req, res) => {
  try {
    const cursor = services.find({});
    const result = await cursor.toArray();

    res.send(result);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch services",
    });
  }
});




// ===============================
// Add Service
// ===============================

app.post('/services', async (req, res) => {
  try {
    const service = req.body;

    const newService = {
      title: service.title,
      category: service.category,
      description: service.description,
      image: service.image,
      serviceMode: service.serviceMode,
      serviceArea: service.serviceArea,
      price: Number(service.price),
      availability: service.availability || "available",

      // Admin approval
      approvalStatus: "pending",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await services.insertOne(newService);

    res.status(201).send({
      success: true,
      message: "Service added successfully",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("Failed to add service:", error);

    res.status(500).send({
      success: false,
      message: "Failed to add service",
    });
  }
});
// ===============================
// Bookings
// ===============================

app.get('/bookings', async (req, res) => {
  try {
    const result = await bookings.find({}).toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

app.post('/bookings', async (req, res) => {
  try {
    const booking = req.body;

    if (!booking || typeof booking !== 'object' || Array.isArray(booking)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking data",
      });
    }

    const newBooking = {
      ...booking,
      status: booking.status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await bookings.insertOne(newBooking);

    res.status(201).send({
      success: true,
      message: "Booking added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to add booking:", error);
    res.status(500).send({
      success: false,
      message: "Failed to add booking",
    });
  }
});


// ===============================
// Payments
// ===============================

app.get('/payments', async (req, res) => {
  try {
    const result = await payments.find({}).toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch payments",
    });
  }
});

app.post('/payments', async (req, res) => {
  try {
    const payment = req.body;

    if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
      return res.status(400).send({
        success: false,
        message: "Invalid payment data",
      });
    }

    const newPayment = {
      ...payment,
      status: payment.status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await payments.insertOne(newPayment);

    res.status(201).send({
      success: true,
      message: "Payment added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to add payment:", error);
    res.status(500).send({
      success: false,
      message: "Failed to add payment",
    });
  }
});


// ===============================
// Start Server
// ===============================

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});