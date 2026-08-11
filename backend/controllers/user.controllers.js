import * as userService from "../services/user.service.js";
import { validationResult } from "express-validator";
import userModel from "../models/user.model.js";
import redisClient from "../services/redis.service.js";

export const createUserController = async (req, res) => {
  // 1) validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // 2) extract fields
    const {email, password } = req.body;

    const user = await userService.createUser(email, password);

    // 4) generate token
    const token = user.generateJWT();
    delete user._doc.password; // remove password from user object before sending response

    // 5) send response (don’t leak password)
    res.status(201).json({
      message: "User created successfully",
      user,
      token,
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const loginUserController = async (req, res) => {
    // 1) validate request
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
    }

    try{
        // 2) extract fields
        const { email, password } = req.body;

        // 3) find user by email
        const user = await userModel.findOne({ email }).select("+password");
        if(!user){
           return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 4) compare password
        const isMatch = await user.isValidPassword(password);
        if(!isMatch){
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 5) generate token
        const token = user.generateJWT();
        delete user._doc.password; // remove password from user object before sending response

        // 6) send response (don’t leak password)
        res.status(200).json({
            message: 'Login successful',
            user,
            token
        });

    }catch(error){
        console.log(error);
        res.status(400).json({ message: error.message });
    }
}

export const profileController = async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: 'User profile',
            user: {
                _id: user._id,
                email: user.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const logoutController = async (req, res) => {
    try{
        // find token 
        const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
        if(!token){
            return res.status(400).json({ message: 'No token found' });
        }
        
        try {
            await redisClient.set(token, 'logout', 'EX', 24 * 60 * 60); // expires in 24 hours
        } catch (redisErr) {
            console.warn("Redis logout error:", redisErr.message);
        }

        res.clearCookie('token');
        res.status(200).json({ message: 'Logout successful' });

    }
    catch(error){
        console.log(error);
        res.status(400).json({ message: error.message });
    }
}

export const getAllUsersController = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUsers = await userService.getAllUsers({ userId: loggedInUser._id });

        return res.status(200).json({
            users: allUsers
        })

    } catch (err) {

        console.log(err)

        res.status(400).json({ error: err.message })

    }
}