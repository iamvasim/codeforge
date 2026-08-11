import mongoose from "mongoose";   // MongoDB ODM
import bcrypt from "bcrypt";       // used to hash passwords
import jwt from "jsonwebtoken";    // used to create tokens (login auth)

// create schema (structure of user document)
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },

    password: {
        type: String,
        select: false
    }

});


// 🔐 STATIC METHOD → used on Model (User.hashPassword())
// This hashes (encrypts) plain password before saving
userSchema.statics.hashPassword = async function(password){
    // bcrypt.hash(password, saltRounds)
    // 10 = salt rounds (security level)
    return await bcrypt.hash(password, 10);
}


// 🔑 INSTANCE METHOD → used on a specific user (user.comparePassword())
// This checks if entered password matches stored hashed password
userSchema.methods.isValidPassword= async function(password){
    // bcrypt.compare(plain, hashed)
    return await bcrypt.compare(password, this.password);
}


// 🎫 GENERATE JWT TOKEN → used after login
userSchema.methods.generateJWT = function(){

    // jwt.sign(payload, secret)
    return jwt.sign(
        { _id: this._id.toString(), email: this.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}


// create model (collection name = "users")
const User = mongoose.model("user", userSchema);

export default User;