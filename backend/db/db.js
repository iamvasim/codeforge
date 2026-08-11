import mongoose from "mongoose";

function connect() {
  

  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB ✅"))
    .catch((err) => console.error("Error:", err));
}

export default connect;