const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wj8hv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("sparrow_doctors_portal")
      .collection("services");
    const bookingsCollection = client
      .db("sparrow_doctors_portal")
      .collection("bookings");
    const userCollection = client
      .db("sparrow_doctors_portal")
      .collection("users");

    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });

      if (requesterAccount?.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      
      res.send({ result, token });
    });
    //!! This is not the proper way to query
    //!! After Learning more about mongoDB use aggregate lookup,pipeline,match, group
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      //**Step 1: get all services */
      const services = await servicesCollection.find().toArray();

      //**Step 2: get the booking of that day*/
      const query = { date: date };
      const bookings = await bookingsCollection.find(query).toArray();

      //**Step 3: for each service
      services.forEach((service) => {
        //**Step:4 find bookings for that service*/[{},{},{},{}]
        const serviceBookings = bookings.filter(
          (booked) => booked.treatment === service.name
        );
        //**Step:5 select slots for the service booked*/ ['','','','']
        const bookedSlots = serviceBookings.map((booking) => booking.slot);
        //**Step:6 select the slots that are not in bookedSlots*/ ['','','','']
        const availableSlots = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //**Step:7 set available slots to make it easier
        service.slots = availableSlots;
      });

      /* 
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (b) => b.treatment === service.name
        );
        const booked = serviceBookings.map((s) => s.slot);
        const available = service.slots.filter((s) => !booked.includes(s));
        service.available = available;
        // service.booked = booked;
        // service.booked = serviceBookings.map((s) => s.slot);
      });

      */
      res.send(services);
    });

    /**
     * API Naming Convention
     * app.get('/booking')  // get all bookings in this collection or get more than one or by filter
     * app.get('/booking/:id') // get a specific booking
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id') // update a specific booking
     * app.put('/booking/:id') // upsert = update(if exists) or insert (if don't exists)
     * app.delete('/booking/:id') // delete a specific booking
     */

    app.get("/bookings", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.query.patient;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const bookings = await bookingsCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    app.post("/bookings", async (req, res) => {
      const bookings = req.body;
      const query = {
        treatment: bookings.treatment,
        date: bookings.date,
        patient: bookings.patient,
      };
      const exists = await bookingsCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingsCollection.insertOne(bookings);
      return res.send({ success: true, result });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () =>
  console.log(`Sparrow Doctor's Portal listening on port ${port}!!`)
);
