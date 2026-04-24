import mongoose, { Schema } from "mongoose";


const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
})
