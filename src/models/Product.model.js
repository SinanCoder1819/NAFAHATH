import mongoose from 'mongoose'

const variantSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    regularPrice: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: 0
    },
    cancelledCount: {
        type: Number,
        min: 0,
        default: 0
    }
})


const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    
    category: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    // Array of the variants (Sizes, prices, stock)
    variants: [variantSchema],
    
    
    primaryImage: {
      type: String,
      default: "",
    },
    galleryImages: [{
      type: String, // Array of file paths/URLs for interior/extra pages
    }],
    
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);
productSchema.index({ productName: 1 });


export default mongoose.model("Product", productSchema);