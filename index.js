import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';
dns.setServers(['8.8.8.8', '1.1.1.1']);


const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

const uploadServiceImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).send({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image must be less than 5MB"
            : error.message || "Invalid image upload",
      });
    }

    next();
  });
};

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

// Get all services
// Admin can use this to manage all services
app.get('/services', async (req, res) => {
  try {
    const query = {};

    if (
      typeof req.query.technicianId === "string" &&
      req.query.technicianId
    ) {
      query.technicianId = req.query.technicianId;
    }

    if (
      typeof req.query.approvalStatus === "string" &&
      req.query.approvalStatus
    ) {
      query.approvalStatus = req.query.approvalStatus;
    }

    const result = await services
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("Failed to fetch services:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch services",
    });
  }
});


// ===============================
// Get Approved Services
// Customer will use this route
// ===============================

app.get('/services/approved', async (req, res) => {
  try {
    const result = await services
      .find({
        approvalStatus: "approved",
        availability: "available",
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error(
      "Failed to fetch approved services:",
      error
    );

    res.status(500).send({
      success: false,
      message: "Failed to fetch approved services",
    });
  }
});


// ===============================
// Get Single Service
// Keep this after the static /services/approved route so
// "approved" is never treated as a service ID
// ===============================

app.get('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID",
      });
    }

    const service = await services.findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      availability: "available",
    });

    if (!service) {
      return res.status(404).send({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).send(service);
  } catch (error) {
    console.error("Failed to fetch service details:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch service details",
    });
  }
});


// ===============================
// Approve Service
// Admin only
// ===============================

app.patch('/services/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID",
      });
    }

    const result = await services.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          approvalStatus: "approved",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Service approved successfully",
    });
  } catch (error) {
    console.error(
      "Failed to approve service:",
      error
    );

    res.status(500).send({
      success: false,
      message: "Failed to approve service",
    });
  }
});


// ===============================
// Reject Service
// Admin only
// ===============================

app.patch('/services/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid service ID",
      });
    }

    const result = await services.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          approvalStatus: "rejected",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Service rejected successfully",
    });
  } catch (error) {
    console.error(
      "Failed to reject service:",
      error
    );

    res.status(500).send({
      success: false,
      message: "Failed to reject service",
    });
  }
});


// ===============================
// Add Service + Upload Image
// ===============================

app.post('/services', uploadServiceImage, async (req, res) => {
  try {
    const service = req.body;

    // ===============================
    // Check required fields
    // ===============================

    if (
      !service.title ||
      !service.category ||
      !service.description ||
      !service.serviceArea ||
      !service.price
    ) {
      return res.status(400).send({
        success: false,
        message: "Required service information is missing",
      });
    }

    // ===============================
    // Check image
    // ===============================

    if (!req.file) {
      return res.status(400).send({
        success: false,
        message: "Service image is required",
      });
    }

    // ===============================
    // ImgBB API Key
    // ===============================

    const imgbbKey = process.env.IMGBB_API_KEY;

    if (!imgbbKey) {
      return res.status(500).send({
        success: false,
        message: "ImgBB is not configured on the server",
      });
    }

    // ===============================
    // Upload Image to ImgBB
    // ===============================

    const formData = new FormData();

    formData.append(
      "image",
      req.file.buffer.toString("base64")
    );

    const imageResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${imgbbKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const imageResult =
      await imageResponse.json();

    if (!imageResult.success) {
      console.error(
        "ImgBB Error:",
        imageResult
      );

      const imgbbMessage =
        imageResult?.error?.message ??
        (typeof imageResult?.error === "string"
          ? imageResult.error
          : null) ??
        "Failed to upload image to ImgBB";

      return res.status(500).send({
        success: false,
        message: imgbbMessage,
      });
    }

    // ===============================
    // ImgBB URL
    // ===============================

    const imageUrl =
      imageResult.data.url;

    // ===============================
    // Create Service
    // ===============================

    const newService = {
      title: service.title,
      category: service.category,
      description: service.description,

      image: imageUrl,

      serviceMode:
        service.serviceMode ||
        "Home Service",

      serviceArea:
        service.serviceArea,

      price:
        Number(service.price),

      availability:
        service.availability ||
        "available",

      technicianId:
        service.technicianId ||
        null,

      technicianName:
        service.technicianName ||
        "",

      technicianEmail:
        service.technicianEmail ||
        "",

      // Important:
      // Every new service starts as pending
      approvalStatus: "pending",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // ===============================
    // Save Service
    // ===============================

    const result =
      await services.insertOne(
        newService
      );

    // ===============================
    // Response
    // ===============================

    res.status(201).send({
      success: true,
      message:
        "Service added successfully",

      service: {
        _id: result.insertedId,
        ...newService,
      },
    });

  } catch (error) {
    console.error(
      "Failed to add service:",
      error
    );

    res.status(500).send({
      success: false,
      message:
        "Failed to add service",
    });
  }
});
// ===============================
// Bookings
// ===============================

app.get('/bookings', async (req, res) => {
  try {
    const query = {};

    for (const key of ['technicianId', 'customerId', 'status']) {
      if (typeof req.query[key] === 'string' && req.query[key]) {
        query[key] = req.query[key];
      }
    }

    const result = await bookings
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).send(result);
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

// Get one booking. Optional actor ids keep customers and technicians scoped
// to their own records.
app.get('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const query = { _id: new ObjectId(id) };

    for (const key of ['customerId', 'technicianId']) {
      if (typeof req.query[key] === 'string' && req.query[key]) {
        query[key] = req.query[key];
      }
    }

    const booking = await bookings.findOne(query);

    if (!booking) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).send(booking);
  } catch (error) {
    console.error("Failed to fetch booking:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch booking",
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


// Accept/decline a booking (technician) or pay for one (customer)
// The Next.js API routes inject the signed-in user's id into the body.
app.patch('/bookings/:id/:action', async (req, res) => {
  try {
    const { id, action } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    if (!['accept', 'decline', 'pay'].includes(action)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking action",
      });
    }

    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    const actorField = action === 'pay' ? 'customerId' : 'technicianId';
    const actorId = req.body?.[actorField];

    if (!actorId || booking[actorField] !== actorId) {
      return res.status(403).send({
        success: false,
        message: "You do not have permission to update this booking",
      });
    }

    const currentStatus = booking.status || 'pending';
    const nextStatus =
      action === 'accept' ? 'accepted'
        : action === 'decline' ? 'declined'
          : 'paid';
    const requiredStatus = action === 'pay' ? 'accepted' : 'pending';

    if (currentStatus !== requiredStatus) {
      return res.status(409).send({
        success: false,
        message:
          action === 'pay'
            ? 'This booking is not ready for payment'
            : `This booking has already been ${currentStatus}`,
      });
    }

    if (action === 'pay') {
      const existingPayment = await payments.findOne({
        bookingId: booking._id,
      });

      if (!existingPayment) {
        await payments.insertOne({
          bookingId: booking._id,
          serviceId: booking.serviceId ?? null,
          serviceTitle: booking.serviceTitle ?? '',
          amount: Number(booking.servicePrice) || 0,
          customerId: booking.customerId ?? null,
          customerName: booking.customerName ?? '',
          customerEmail: booking.customerEmail ?? '',
          technicianId: booking.technicianId ?? null,
          technicianName: booking.technicianName ?? '',
          status: 'paid',
          method: req.body?.method ?? 'stripe',
          paymentReference: req.body?.paymentReference ?? null,
          stripeSessionId: req.body?.stripeSessionId ?? null,
          stripePaymentIntentId: req.body?.stripePaymentIntentId ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const result = await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: nextStatus,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).send({
      success: true,
      message:
        action === 'accept' ? 'Booking accepted'
          : action === 'decline' ? 'Booking declined'
            : 'Payment recorded successfully',
      status: nextStatus,
    });
  } catch (error) {
    console.error("Failed to update booking:", error);
    res.status(500).send({
      success: false,
      message: "Failed to update booking",
    });
  }
});


// ===============================
// Payments
// ===============================

app.get('/payments', async (req, res) => {
  try {
    const query = {};

    for (const key of ['customerId', 'technicianId']) {
      if (typeof req.query[key] === 'string' && req.query[key]) {
        query[key] = req.query[key];
      }
    }

    const result = await payments.find(query).toArray();
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