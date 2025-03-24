// const express = require('express');
// const mongoose = require('mongoose');
// const jwt = require('jsonwebtoken');
// const dotenv = require('dotenv');
// const User = require('./models/Users');
// const crypto = require('crypto');
// const cors = require('cors') ;
// dotenv.config();

// const app = express();

// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('MongoDB connected...'))
// .catch(err => console.error(err));

// app.use(cors()) ;
// app.use(express.json());

// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 256 bits (32 characters)
// const IV_LENGTH = 16; // For AES, this is always 16

// function encrypt(text) {
//   let iv = crypto.randomBytes(IV_LENGTH);
//   let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
//   let encrypted = cipher.update(text);

//   encrypted = Buffer.concat([encrypted, cipher.final()]);

//   return iv.toString('hex') + ':' + encrypted.toString('hex');
// }

// function decrypt(text) {
//   let textParts = text.split(':');
//   let iv = Buffer.from(textParts.shift(), 'hex');
//   let encryptedText = Buffer.from(textParts.join(':'), 'hex');
//   let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
//   let decrypted = decipher.update(encryptedText);

//   decrypted = Buffer.concat([decrypted, decipher.final()]);

//   return decrypted.toString();
// }

// // Register route
// app.post('/api/auth/register', async (req, res) => {
//   const { name, email, password, role } = req.body;

//   try {
//     let user = await User.findOne({ email });
//     if (user) {
//       return res.status(400).json({ msg: 'User already exists' });
//     }

//     user = new User({
//       name,
//       email,
//       password: encrypt(password),
//       role,
//     });

//     await user.save();

//     const payload = {
//       user: {
//         id: user.id,
//         role: user.role,
//       },
//     };

//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' },
//       (err, token) => {
//         if (err) throw err;
//         res.json({ token });
//       }
//     );
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// // Login route
// app.post('/api/auth/login', async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     let user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ msg: 'Invalid credentials' });
//     }

//     const decryptedPassword = decrypt(user.password);
//     if (password !== decryptedPassword) {
//       return res.status(400).json({ msg: 'Invalid credentials' });
//     }

//     const payload = {
//       user: {
//         id: user.id,
//         role: user.role,
//       },
//     };

//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '1d' },
//       (err, token) => {
//         if (err) throw err;
//         res.json({ token });
//       }
//     );
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// // Middleware to verify token
// const auth = (req, res, next) => {
//   const token = req.header('x-auth-token');

//   if (!token) {
//     return res.status(401).json({ msg: 'No token, authorization denied' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded.user;
//     next();
//   } catch (err) {
//     res.status(401).json({ msg: 'Token is not valid' });
//   }
// };

// // Fetch all admins route with decrypted passwords
// app.get('/api/auth/admins', auth, async (req, res) => {
//   try {
//     // Check if the requesting user is a superadmin
//     if (req.user.role !== 'superadmin') {
//       return res.status(403).json({ msg: 'Access denied. Superadmin only.' });
//     }

//     const admins = await User.find({ role: 'admin' });

//     const adminsWithDecryptedPasswords = admins.map(admin => ({
//       id: admin._id,
//       name: admin.name,
//       email: admin.email,
//       role: admin.role,
//       password: decrypt(admin.password)
//     }));

//     res.json(adminsWithDecryptedPasswords);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// // Protected route example
// app.get('/api/auth/protected', auth, (req, res) => {
//   res.json({ msg: 'Welcome to the protected route', user: req.user });
// });

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const crypto = require("crypto");
const cron = require("node-cron");
const User = require("./models/Users");
const PendingUser = require("./models/PendingUsers");
const cors = require("cors");
const moment = require("moment-timezone");
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const { check, validationResult } = require('express-validator');

dotenv.config();

const app = express();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected..."))
  .catch((err) => console.error(err));

app.use(cors());
app.use('/QR', express.static(path.join(__dirname, '/QR')));
app.use(express.json());

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";
const IV_LENGTH = 16;

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  let textParts = text.split(":");
  let iv = Buffer.from(textParts.shift(), "hex");
  let encryptedText = Buffer.from(textParts.join(":"), "hex");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

// Register route
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, town, address } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    user = new User({
      name,
      email,
      password: encrypt(password),
      role,
      town,
      address,
    });

    await user.save();

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Login route
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const decryptedPassword = decrypt(user.password);
    if (password !== decryptedPassword) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.header("x-auth-token");

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};

// Fetch all admins route with decrypted passwords
app.get("/api/auth/admins", auth, async (req, res) => {
  try {
    // Check if the requesting user is a superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ msg: "Access denied. Superadmin only." });
    }

    const admins = await User.find({ role: "admin" });

    const adminsWithDecryptedPasswords = admins.map((admin) => ({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      town: admin.town,
      address: admin.address,
      password: decrypt(admin.password),
    }));

    res.json(adminsWithDecryptedPasswords);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Route for admins to create users
app.post("/api/auth/create-user", auth, async (req, res) => {
  const { name, email, password, address, town } = req.body;

  try {
    // Check if the requesting user is an admin or superadmin
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res
        .status(403)
        .json({ msg: "Access denied. Admin or Superadmin only." });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    user = new User({
      name,
      email,
      password: encrypt(password),
      role: "user",
      createdBy: req.user.id,
      address, 
      town
    });

    await user.save();

    res.json({ msg: "User created successfully", user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Fetch all users created by an admin
app.get("/api/auth/users", auth, async (req, res) => {
  try {
    // Check if the requesting user is an admin or superadmin
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res
        .status(403)
        .json({ msg: "Access denied. Admin or Superadmin only." });
    }

    let users;
    if (req.user.role === "admin") {
      users = await User.find({ createdBy: req.user.id });
    } else if (req.user.role === "superadmin") {
      users = await User.find({ role: "user" })
        .populate("createdBy", "name email");
    }
    const data = {
      users: users.map((user) => {
        const value = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          town: user.town,
          address: user.address,
          password: decrypt(user.password),
        };
        return value ;
      }),
    };

    // console.log("DATA ::::",data) ;

    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Fetch all users with admin details (superadmin only)
app.get("/api/auth/all-users", auth, async (req, res) => {
  try {
    // Check if the requesting user is a superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ msg: "Access denied. Superadmin only." });
    }

    const users = await User.find({ role: "user" }).populate(
      "createdBy",
      "name email"
    );

    // console.log("Users ::: ", users);

    const data = {
      users: users.map((user) => {
        const value = {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          town: user.town,
          createdBy : user.createdBy,
          hasWonLottery: user.hasWonLottery,
          lastWinDate : user.lastWinDate,
          scheduledLotteryTime : user.scheduledLotteryTime,
          address: user.address,
          password: decrypt(user.password),
        };
        return value ;
      }),
    };

    // console.log("DATA ::: ", data);

    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Edit user/admin route
app.put("/api/auth/edit-user/:id", auth, async (req, res) => {
  const { name, email, password, role, town, address } = req.body;
  const userId = req.params.id;

  try {
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ msg: "Current user not found" });
    }

    if (currentUser.role === "admin" && role === "admin") {
      return res
        .status(403)
        .json({ msg: "Access denied. Admin cannot edit other admins." });
    }

    if (currentUser.role === "admin") {
      const userToEdit = await User.findById(userId);
      if (!userToEdit) {
        return res.status(404).json({ msg: "User not found" });
      }

      if (userToEdit.createdBy.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ msg: "Access denied. Admin can only edit their own users." });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        email,
        password: password ? encrypt(password) : undefined,
        role,
        town,
        address,
      },
      { new: true }
    );

    res.json(updatedUser);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Delete user/admin route
app.delete("/api/auth/delete-user/:id", auth, async (req, res) => {
  const userId = req.params.id;

  try {
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ msg: "Current user not found" });
    }

    // Check if the current user is allowed to delete the user/admin
    if (currentUser.role === "admin" && role === "admin") {
      return res
        .status(403)
        .json({ msg: "Access denied. Admin cannot delete other admins." });
    }

    if (currentUser.role === "admin") {
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        return res.status(404).json({ msg: "User not found" });
      }

      if (userToDelete.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          msg: "Access denied. Admin can only delete their own users.",
        });
      }
    }

    await User.findByIdAndDelete(userId);

    res.json({ msg: "User deleted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.post("/api/auth/select-lottery-winner", auth, async (req, res) => {
  const { userId } = req.body;

  try {
    // Check if the requesting user is a superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ msg: "Access denied. Superadmin only." });
    }

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Ensure the user is not an admin or superadmin
    if (user.role !== "user") {
      return res
        .status(400)
        .json({ msg: "Cannot select an admin or superadmin for the lottery." });
    }

    // Ensure the user has not already won the lottery this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (user.lastWinDate && user.lastWinDate >= startOfMonth) {
      return res
        .status(400)
        .json({ msg: "User has already won the lottery this month." });
    }

    // Check if there is already a lottery winner for this month under the same admin
    const existingWinner = await User.findOne({
      createdBy: user.createdBy,
      role: "user",
      lastWinDate: { $gte: startOfMonth },
    });

    if (existingWinner) {
      return res
        .status(400)
        .json({
          msg: "This admin already has a lottery winner for this month.",
        });
    }

    // Check if all users under the same admin have won
    const usersUnderAdmin = await User.find({
      createdBy: user.createdBy,
      role: "user",
    });
    const usersWhoHaveNotWon = usersUnderAdmin.filter((u) => !u.hasWonLottery);

    if (usersWhoHaveNotWon.length === 0) {
      // Reset hasWonLottery for all users under this admin
      await User.updateMany(
        { createdBy: user.createdBy, role: "user" },
        { $set: { hasWonLottery: false } }
      );
      // Refetch the users after resetting
      const resetUsers = await User.find({
        createdBy: user.createdBy,
        role: "user",
      });
      // Check if the selected user has won the lottery previously
      const selectedUser = resetUsers.find((u) => u._id.toString() === userId);
      if (selectedUser.hasWonLottery) {
        return res
          .status(400)
          .json({ msg: "Other users need to win the lottery first." });
      }
    } else if (!usersWhoHaveNotWon.some((u) => u._id.toString() === userId)) {
      return res
        .status(400)
        .json({ msg: "Other users need to win the lottery first." });
    }

    // Update the user's lottery status
    user.hasWonLottery = true;
    user.lastWinDate = now;
    await user.save();

    res.json({ msg: "Lottery winner selected", winner: user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.get("/api/auth/all-winners", auth, async (req, res) => {
  try {
    // Check if the requesting user is a superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ msg: "Access denied. Superadmin only." });
    }

    // Find all admins
    const admins = await User.find({ role: "admin" });

    // Get all users who have won the lottery
    const allWinners = await User.find({ role: "user", hasWonLottery: true });

    // Organize winners by their respective admin
    const adminWinners = admins.map((admin) => {
      const adminUsers = allWinners.filter(
        (user) => user.createdBy.toString() === admin._id.toString()
      );
      return {
        admin,
        winners: adminUsers,
      };
    });

    res.json({ adminWinners });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.get("/api/auth/admin-winners", auth, async (req, res) => {
  try {
    // Check if the requesting user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Admin only." });
    }

    // Find all users created by this admin who have won the lottery
    const winners = await User.find({
      createdBy: req.user.id,
      role: "user",
      hasWonLottery: true,
    });

    console.log("WINNERS ::: ",winners) ;

    res.json({ winners });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.get("/api/auth/users-under-admin", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.role === "admin" || user.role === "superadmin") {
      return res
        .status(403)
        .json({
          msg: "Access denied. Only users can access this information.",
        });
    }

    const usersUnderAdmin = await User.find({
      createdBy: user.createdBy,
      role: "user",
    });

    res.json({ users: usersUnderAdmin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.post("/api/auth/schedule-lottery", auth, async (req, res) => {
  const { dateTime } = req.body;

  try {
    // Check if the requesting user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Admin only." });
    }

    // Update the scheduled lottery time for all users under this admin
    await User.updateMany(
      { createdBy: req.user.id, role: "user" },
      { $set: { scheduledLotteryTime: new Date(dateTime) } }
    );

    res.json({
      msg: "Scheduled lottery time set for all users under this admin.",
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// app.put('/api/auth/edit-scheduled-lottery/:adminId', auth, async (req, res) => {
//   const { adminId } = req.params;
//   const { dateTime } = req.body;

//   try {
//     // Check if the requesting user is an admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ msg: 'Access denied. Admin only.' });
//     }

//     // Update the scheduled lottery time for all users under this admin
//     await User.updateMany(
//       { createdBy: adminId, role: 'user' },
//       { $set: { scheduledLotteryTime: new Date(dateTime) } }
//     );

//     res.json({ msg: 'Scheduled lottery time updated for all users under this admin.' });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

app.put("/api/auth/edit-scheduled-lottery", auth, async (req, res) => {
  const { dateTime } = req.body;

  try {
    // Check if the requesting user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Admin only." });
    }

    // Convert dateTime to UTC
    const utcDateTime = moment(dateTime).utc().toDate();

    // Update the scheduled lottery time for all users under this admin
    await User.updateMany(
      { createdBy: req.user.id, role: "user" },
      { $set: { scheduledLotteryTime: utcDateTime } }
    );

    res.json({
      msg: "Scheduled lottery time updated for all users under this admin.",
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get the current lottery time for an admin
app.get("/api/auth/get-lottery-time/:adminId", auth, async (req, res) => {
  const { adminId } = req.params;

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Admin only." });
    }

    // Find any user under the given admin to get the scheduled lottery time
    const user = await User.findOne({
      createdBy: adminId,
      role: "user",
      scheduledLotteryTime: { $exists: true },
    });

    if (!user) {
      return res.json({ dateTime: null });
    }

    res.json({ dateTime: user.scheduledLotteryTime });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// User view their own profile
app.get("/api/auth/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    const userDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      password: decrypt(user.password),
      address : user.address,
      town : user.town
    };
    
    res.json(userDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// User edit their own profile
app.put("/api/auth/user", auth, async (req, res) => {
  const { name, password, town, address } = req.body;

  const updatedFields = {};

  if (name) updatedFields.name = name;
  if (town) updatedFields.town = town;
  if (address) updatedFields.address = address;
  if (password) updatedFields.password = encrypt(password);

  try {
    let user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updatedFields },
      { new: true }
    );

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Admin upload/update mobile number, UPI ID, QR Code Image


// Set up storage engine
const storage = multer.diskStorage({
  destination: './QR/',
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 4000000 }, // 1MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).single('qrCodeImage');

function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

// PUT API for Admin to update their info
app.put('/api/auth/admin/update-info', auth, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ msg: err });
    }

    const { mobileNumber, upiId, lotteryName } = req.body;
    let qrCodeImage;

    if (req.file) {
      qrCodeImage = `/QR/${req.file.filename}`;
    }

    try {
      // Check if the requesting user is an admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin only.' });
      }

      const updatedFields = {};
      if (mobileNumber) updatedFields.mobileNumber = mobileNumber;
      if (upiId) updatedFields.upiId = upiId;
      if (qrCodeImage) updatedFields.qrCodeImage = qrCodeImage;
      if (lotteryName) updatedFields.lotteryName = lotteryName;

      console.log("USER ::: ", req.user) ;

      let user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updatedFields },
        { new: true }
      );

      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });
});

// Admin name/change the name of lottery
// app.put('/api/auth/admin/update-lottery-name', auth, async (req, res) => {
//   const { lotteryName } = req.body;

//   try {
//     // Check if the requesting user is an admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ msg: 'Access denied. Admin only.' });
//     }

//     if (!lotteryName) {
//       return res.status(400).json({ msg: 'Lottery name is required' });
//     }

//     let user = await User.findById(req.user.id);
//     if (!user) {
//       return res.status(404).json({ msg: 'User not found' });
//     }

//     user = await User.findByIdAndUpdate(
//       req.user.id,
//       { $set: { lotteryName } },
//       { new: true }
//     );

//     res.json(user);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

// Users view their admin's info
app.get('/api/auth/admin-info', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const admin = await User.findById(user.createdBy).select('mobileNumber upiId qrCodeImage lotteryName');
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


app.get('/api/auth/winners-under-admin', auth, async (req, res) => {
  try {
    // Find the user making the request
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if the user is not an admin or superadmin
    if (user.role === 'admin' || user.role === 'superadmin') {
      return res.status(403).json({ msg: 'Access denied. Only users can access this information.' });
    }

    // Find all users created by the same admin who have won the lottery
    const winnersUnderAdmin = await User.find({ createdBy: user.createdBy, role: 'user', hasWonLottery: true });

    res.json({ winners: winnersUnderAdmin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/signup',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid Mobile number').not().isEmpty(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('address', 'Address is required').not().isEmpty(),
    check('town', 'Town is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, address, town } = req.body;

    try {
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: 'User already exists' });
      }

      let pendingUser = await PendingUser.findOne({ email });
      if (pendingUser) {
        return res.status(400).json({ msg: 'User is already pending verification' });
      }

      pendingUser = new PendingUser({
        name,
        email,
        password,
        address,
        town
      });

      // Encrypt password
      pendingUser.password = encrypt(password);

      await pendingUser.save();

      res.status(200).json({ msg: 'User submitted for verification' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

app.get('/api/auth/pending-users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Access denied. Superadmin only.' });
    }

    const pendingUsers = await PendingUser.find();
    const user = pendingUsers.map((pendingUsers) => ({
      id : pendingUsers._id,
      name : pendingUsers.name,
      email : pendingUsers.email,
      password : decrypt(pendingUsers.password),
      address : pendingUsers.address,
      town : pendingUsers.town
    }))
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// app.put('/api/auth/verify-user/:id', auth, async (req, res) => {
//   try {
//     if (req.user.role !== 'superadmin') {
//       return res.status(403).json({ msg: 'Access denied. Superadmin only.' });
//     }

//     const pendingUser = await PendingUser.findById(req.params.id);

//     if (!pendingUser) {
//       return res.status(404).json({ msg: 'Pending user not found' });
//     }

//     const { name, email, password, address, town } = pendingUser;

//     const newUser = new User({
//       name,
//       email,
//       password,
//       address,
//       town,
//       role: 'admin'
//     });

//     await newUser.save();

//     await PendingUser.findByIdAndDelete(req.params.id);
//     const passwordDec = decrypt(password)
//     const urlFinal = `https://sms.par-ken.com/api/smsapi?key=d8fefc4e4949a649002e5deab1a76b6a&route=1&sender=IMSTRG&number=${{email}}&sms=Dear%20Customer,%20Your%20login%20credentials%20for%20the%20VC%20Lottery%20are%20as%20follows-%20Email%20ID:%20${{email}}%20Password:%20${{passwordDec}}%20Please%20keep%20this%20information%20secure%20and%20do%20not%20share%20it%20with%20anyone.%20For%20any%20assistance,%20feel%20free%20to%20contact%20our%20support%20team.%20Thank%20you.%20ps&templateid=1407172122032382942`

//     res.json({ msg: 'User verified and registered as admin', url :  urlFinal});
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// });

app.put('/api/auth/verify-user/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Access denied. Superadmin only.' });
    }

    const pendingUser = await PendingUser.findById(req.params.id);

    if (!pendingUser) {
      return res.status(404).json({ msg: 'Pending user not found' });
    }

    const { name, email, password, address, town } = pendingUser;

    const newUser = new User({
      name,
      email,
      password,
      address,
      town,
      role: 'admin'
    });

    await newUser.save();
    await PendingUser.findByIdAndDelete(req.params.id);
    
    const passwordDec = decrypt(password);
    const urlFinal = `https://sms.par-ken.com/api/smsapi?key=d8fefc4e4949a649002e5deab1a76b6a&route=1&sender=IMSTRG&number=${email}&sms=Dear%20Customer,%20Your%20login%20credentials%20for%20the%20VC%20Lottery%20are%20as%20follows-%20Email%20ID:%20${email}%20Password:%20${passwordDec}%20Please%20keep%20this%20information%20secure%20and%20do%20not%20share%20it%20with%20anyone.%20For%20any%20assistance,%20feel%20free%20to%20contact%20our%20support%20team.%20Thank%20you.%20ps&templateid=1407172122032382942`;

    try {
      await axios.get(urlFinal);
      res.json({ msg: 'User verified and registered as admin, SMS sent' });
    } catch (smsError) {
      console.error('User verified and registered as admin, but failed to send SMS', smsError.message);
      res.json({ msg: 'User verified and registered as admin, but failed to send SMS' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    const users = await User.find({
      scheduledLotteryTime: { $lte: now },
      role: "user",
    });

    for (const user of users) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const existingWinner = await User.findOne({
        createdBy: user.createdBy,
        role: "user",
        lastWinDate: { $gte: startOfMonth },
      });

      if (!existingWinner) {
        const usersUnderAdmin = await User.find({
          createdBy: user.createdBy,
          role: "user",
        });
        const usersWhoHaveNotWon = usersUnderAdmin.filter(
          (u) => !u.hasWonLottery
        );

        if (usersWhoHaveNotWon.length > 0) {
          const randomUser =
            usersWhoHaveNotWon[
              Math.floor(Math.random() * usersWhoHaveNotWon.length)
            ];

          randomUser.hasWonLottery = true;
          randomUser.lastWinDate = now;
          await randomUser.save();

          console.log(`Random lottery winner selected: ${randomUser.name}`);
        } else {
          await User.updateMany(
            { createdBy: user.createdBy, role: "user" },
            { $set: { hasWonLottery: false } }
          );

          const resetUsers = await User.find({
            createdBy: user.createdBy,
            role: "user",
          });
          const randomUser =
            resetUsers[Math.floor(Math.random() * resetUsers.length)];

          randomUser.hasWonLottery = true;
          randomUser.lastWinDate = now;
          await randomUser.save();

          console.log(
            `Random lottery winner selected after reset: ${randomUser.name}`
          );
        }
      }
    }
  } catch (err) {
    console.error(err.message);
  }
});

// Protected route example
app.get("/api/auth/protected", auth, (req, res) => {
  res.json({ msg: "Welcome to the protected route", user: req.user });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
