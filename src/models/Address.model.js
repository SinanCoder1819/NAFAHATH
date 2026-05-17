import mongoose, { Schema } from "mongoose";

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    addressLine: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    postalCode: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Address", addressSchema);
