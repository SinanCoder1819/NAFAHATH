import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    price: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    }
});

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    items: [cartItemSchema],
    cartTotal: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Middleware to calculate total price before saving
cartSchema.pre('save', function() {
    if (this.items && this.items.length > 0) {
        this.cartTotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
    } else {
        this.cartTotal = 0;
    }
});

export default mongoose.model("Cart", cartSchema);
