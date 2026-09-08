import mongoose from "mongoose";
import Product from "../../models/Product.model.js";
import Category from "../../models/Category.model.js";


const PAGE_SIZE = 5;

const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


export const getProducts = async (req, res) => {
  try {
  
    const page = Math.max(1, parseInt(req.query.page) || 1);
    
    
    const search = (req.query.search || "").trim();
    
    // 3. Create an empty query filter object for MongoDB
    const filter = {};

  
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { productName: { $regex: safeSearch, $options: "i" } },
        { brand: { $regex: safeSearch, $options: "i" } }
      ];
    }


    const totalProducts = await Product.countDocuments(filter);
    

    const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
    
    
    const currentPage = Math.min(page, totalPages);

 
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();

  
    res.render("admin/products", {
      layout: "layouts/admin",   
      admin: req.session.admin,  
      activePage: "products",
      products: products,
      search: search,
      currentPage: currentPage,
      totalPages: totalPages,
      error: req.query.error || "",
      success: req.query.success || "",
    });
      
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server Error while loading products");
  }
};


export const getAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({ 
      isDeleted: false }).sort({ name: 1 }).lean();
    
    res.render("admin/addProducts", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "products",
      categories: categories,
      error: req.query.error || "",
    });

  } catch (error) {
    console.error("Error loading add product page:", error);
    res.redirect("/admin/products?error=Server error");
  }
};


export const postAddProduct = async (req, res) => {
  try {
    let { productName, description, category, brand, variantSize, stock, regularPrice, salePrice, redirectToDetails } = req.body;

    if (redirectToDetails === 'true') {
      if (!productName || productName.trim().length < 3) {
        productName = (productName && productName.trim().length > 0) ? productName.trim() : "New Product " + Date.now().toString().slice(-4);
      }
      if (!description || description.trim().length < 10) {
        description = (description && description.trim().length > 0) ? description.trim() + " (Product details)" : "Product description details for storefront.";
      }
      if (!brand || brand.trim().length < 1) {
        brand = "Nafahath";
      }
      if (!category) {
        const firstCat = await Category.findOne({ isDeleted: false });
        category = firstCat ? firstCat.name : "Uncategorized";
      }
    } else {
      if (!productName || productName.length < 3) {
        return res.redirect("/admin/addProducts?error=Product Name must be at least 3 characters");
      }
      if (!description || description.length < 10) {
        return res.redirect("/admin/addProducts?error=Description must be at least 10 characters");
      }
      if (!category || !brand) {
        return res.redirect("/admin/addProducts?error=Category and Brand are required");
      }
    }


    

    const variants = [];
    if (variantSize) {
      
      if (Array.isArray(variantSize)) {
        for (let i = 0; i < variantSize.length; i++) {
          variants.push({
            size: variantSize[i],
            stock: Number(stock[i]) || 0,
            regularPrice: Number(regularPrice[i]) || 0,
            salePrice: Number(salePrice[i]) || 0
          });
        }
      } else {
        
        variants.push({
          size: variantSize,
          stock: Number(stock) || 0,
          regularPrice: Number(regularPrice) || 0,
          salePrice: Number(salePrice) || 0
        });
      }
    }


  

  
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      
      
      if (v.stock < 0 || !Number.isInteger(v.stock)) {
        return res.redirect(`/admin/addProducts?error=Stock cannot be negative and must be an integer`);
      }
      if (v.regularPrice <= 0) {
        return res.redirect(`/admin/addProducts?error=Regular Price must be greater than 0`);
      }
      if (v.salePrice < 0) {
        return res.redirect(`/admin/addProducts?error=Sale Price cannot be negative`);
      }
      if (v.salePrice > 0 && v.salePrice >= v.regularPrice) {
        return res.redirect(`/admin/addProducts?error=Sale Price must be less than Regular Price`);
      }
    }
   
    

    // 4. Process Uploaded Images (Cloudinary secure_urls uploaded via Multer)
    const galleryImages = [];
    if (req.files) {
      for (let i = 1; i <= 4; i++) {
        const fieldName = `galleryImage${i}`;
        if (req.files[fieldName] && req.files[fieldName].length > 0) {
          const fileObj = req.files[fieldName][0];
          const fileUrl = fileObj.secure_url || fileObj.path || fileObj.url || "";
          if (fileUrl) {
            galleryImages.push(fileUrl);
          }
        }
      }
    }



    let primaryImage = "";
    if (galleryImages.length > 0) {
      primaryImage = galleryImages[0];
    }

    
    const newProduct = new Product({
      productName,
      description,
      category,
      brand,
      variants,
      primaryImage,
      galleryImages
    });

  
    await newProduct.save();

    if (req.body.redirectToDetails === 'true') {
      return res.redirect(`/admin/products/details?id=${newProduct._id}&success=Product added successfully. You can now manage variants.`);
    }

    res.redirect("/admin/products?success=Product added successfully");

  } catch (error) {
    console.error("Error adding product:", error);
    res.redirect("/admin/addProducts?error=Failed to add product");
  }
};


export const getEditProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    if (!productId) {
      return res.redirect("/admin/products?error=Product ID is missing");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect("/admin/products?error=Product not found");
    }

    // 3. Fetch all active categories to show in the edit category dropdown
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

    res.render("admin/editProducts", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "products",
      product: product,
      categories: categories,
      error: req.query.error || "",
    });

  } catch (error) {
    console.error("Error fetching product for edit:", error);
    res.redirect("/admin/products?error=Server error");
  }
};


export const postEditProduct = async (req, res) => {
  const productId = req.query.id;
  if (!productId) {
    return res.redirect("/admin/products?error=Product ID is missing");
  }

  try {
    const { productName, description, category, brand, variantSize, variantId, stock, regularPrice, salePrice, deletedImages } = req.body;


    if (!productName || productName.length < 3) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Product Name must be at least 3 characters`);
    }
    if (!description || description.length < 10) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Description must be at least 10 characters`);
    }
    if (!category || !brand) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Category and Brand are required`);
    }

   
    const duplicateProduct = await Product.findOne({
      _id: { $ne: productId }, 
      productName: { $regex: `${escapeRegex(productName)}$`, $options: "i" } 
    });
    if (duplicateProduct) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Product already exists`);
    }


    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.redirect("/admin/products?error=Product not found");
    }

  
    const variants = [];
    if (variantSize) {
      if (Array.isArray(variantSize)) {
        for (let i = 0; i < variantSize.length; i++) {
          const vObj = {
            size: variantSize[i],
            stock: Number(stock[i]) || 0,
            regularPrice: Number(regularPrice[i]) || 0,
            salePrice: Number(salePrice[i]) || 0
          };
          const curVId = Array.isArray(variantId) ? variantId[i] : (i === 0 ? variantId : null);
          if (curVId && mongoose.Types.ObjectId.isValid(curVId)) {
            vObj._id = curVId;
          }
          variants.push(vObj);
        }
      } else {
        const vObj = {
          size: variantSize,
          stock: Number(stock) || 0,
          regularPrice: Number(regularPrice) || 0,
          salePrice: Number(salePrice) || 0
        };
        const curVId = Array.isArray(variantId) ? variantId[0] : variantId;
        if (curVId && mongoose.Types.ObjectId.isValid(curVId)) {
          vObj._id = curVId;
        }
        variants.push(vObj);
      }
    }

    
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (v.stock < 0 || !Number.isInteger(v.stock)) {
        return res.redirect(`/admin/products/edit?id=${productId}&error=Stock cannot be negative and must be an integer`);
      }
      if (v.regularPrice <= 0) {
        return res.redirect(`/admin/products/edit?id=${productId}&error=Regular Price must be greater than 0`);
      }
      if (v.salePrice < 0) {
        return res.redirect(`/admin/products/edit?id=${productId}&error=Sale Price cannot be negative`);
      }
      if (v.salePrice > 0 && v.salePrice >= v.regularPrice) {
        return res.redirect(`/admin/products/edit?id=${productId}&error=Sale Price must be less than Regular Price`);
      }
    }


    if (deletedImages) {
     
      let deletedIndices = [];
      if (Array.isArray(deletedImages)) {
        deletedIndices = deletedImages;
      } else {
        deletedIndices = [deletedImages];
      }

      for (let i = 0; i < deletedIndices.length; i++) {
        const index = Number(deletedIndices[i]);
        if (existingProduct.galleryImages[index] !== undefined) {
          existingProduct.galleryImages[index] = "";
        }
      }
    }


    if (req.files) {
      for (let i = 1; i <= 4; i++) {
        const fieldName = `galleryImage${i}`;
        if (req.files[fieldName] && req.files[fieldName].length > 0) {
          const newUrl = req.files[fieldName][0].secure_url;
          existingProduct.galleryImages[i - 1] = newUrl;
        }
      }
    }

    
    const cleanGallery = [];
    for (let i = 0; i < existingProduct.galleryImages.length; i++) {
      const img = existingProduct.galleryImages[i];
      if (img && img.trim() !== "") {
        cleanGallery.push(img);
      }
    }
    existingProduct.galleryImages = cleanGallery;


    let primaryImage = existingProduct.primaryImage;
    if (existingProduct.galleryImages.length > 0) {
      primaryImage = existingProduct.galleryImages[0];
    }


    existingProduct.productName = productName;
    existingProduct.description = description;
    existingProduct.category = category;
    existingProduct.brand = brand;
    if (variantSize) {
      existingProduct.variants = variants;
    }
    existingProduct.primaryImage = primaryImage;

    
    await existingProduct.save();

    res.redirect("/admin/products?success=Product updated successfully");

  } catch (error) {
    console.error("Error updating product:", error);
    res.redirect(`/admin/products/edit?id=${productId}&error=Failed to update product`);
  }
};


export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.isDeleted = !product.isDeleted;

   
    
    await product.save();
    
    res.json({ success: true, isDeleted: product.isDeleted });

  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
};


export const getProductDetail = async (req, res) => {
  try {
    const productId = req.params.id || req.query.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect("/admin/products?error=Invalid or missing Product ID");
    }

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.redirect("/admin/products?error=Product not found");
    }

    const variants = product.variants || [];
    const totalVariants = variants.length;
    const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    
    let minPrice = 0;
    if (variants.length > 0) {
      const prices = variants.map(v => {
        if (v.salePrice && v.salePrice > 0 && v.salePrice < v.regularPrice) {
          return v.salePrice;
        }
        return v.regularPrice || 0;
      });
      minPrice = Math.min(...prices);
    }

    const inStock = totalStock > 0 ? "Yes" : "No";

    const createdAtFormatted = product.createdAt ? new Date(product.createdAt).toDateString() : "N/A";
    const updatedAtFormatted = product.updatedAt ? new Date(product.updatedAt).toDateString() : "N/A";

    res.render("admin/productDetail", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "products",
      product,
      totalVariants,
      minPrice,
      totalStock,
      inStock,
      createdAtFormatted,
      updatedAtFormatted,
      success: req.query.success || "",
      error: req.query.error || ""
    });

  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("/admin/products?error=Server error loading product details");
  }
};


// POST /admin/products/:productId/variants/add
export const addVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const { size, stock, regularPrice, salePrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product ID" });
    }

    if (!size || size.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Variant Size/Name is required" });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      return res.status(400).json({ success: false, message: "Stock must be a non-negative integer" });
    }

    const regPriceNum = Number(regularPrice);
    if (isNaN(regPriceNum) || regPriceNum <= 0) {
      return res.status(400).json({ success: false, message: "Regular price must be greater than 0" });
    }

    const salePriceNum = Number(salePrice) || 0;
    if (salePriceNum < 0) {
      return res.status(400).json({ success: false, message: "Sale price cannot be negative" });
    }

    if (salePriceNum > 0 && salePriceNum >= regPriceNum) {
      return res.status(400).json({ success: false, message: "Sale price must be less than regular price" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Check duplicate variant size
    const duplicate = product.variants.find(
      v => v.size.trim().toLowerCase() === size.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({ success: false, message: `Variant '${size.trim()}' already exists` });
    }

    product.variants.push({
      size: size.trim(),
      stock: stockNum,
      regularPrice: regPriceNum,
      salePrice: salePriceNum
    });

    await product.save();

    res.json({ success: true, message: "Variant added successfully" });
  } catch (error) {
    console.error("Error adding variant:", error);
    res.status(500).json({ success: false, message: "Server error while adding variant" });
  }
};

// POST /admin/products/:productId/variants/:variantId/edit
export const editVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { size, stock, regularPrice, salePrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid Product or Variant ID" });
    }

    if (!size || size.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Variant Size/Name is required" });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      return res.status(400).json({ success: false, message: "Stock must be a non-negative integer" });
    }

    const regPriceNum = Number(regularPrice);
    if (isNaN(regPriceNum) || regPriceNum <= 0) {
      return res.status(400).json({ success: false, message: "Regular price must be greater than 0" });
    }

    const salePriceNum = Number(salePrice) || 0;
    if (salePriceNum < 0) {
      return res.status(400).json({ success: false, message: "Sale price cannot be negative" });
    }

    if (salePriceNum > 0 && salePriceNum >= regPriceNum) {
      return res.status(400).json({ success: false, message: "Sale price must be less than regular price" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const variantIndex = product.variants.findIndex(
      v => (v._id && v._id.toString() === variantId.toString()) || (v.id && v.id.toString() === variantId.toString())
    );
    if (variantIndex === -1) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // Check duplicate variant size (excluding current variant)
    const duplicate = product.variants.find(
      (v, idx) => idx !== variantIndex && v.size.trim().toLowerCase() === size.trim().toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({ success: false, message: `Variant '${size.trim()}' already exists` });
    }

    product.variants[variantIndex].size = size.trim();
    product.variants[variantIndex].stock = stockNum;
    product.variants[variantIndex].regularPrice = regPriceNum;
    product.variants[variantIndex].salePrice = salePriceNum;

    await product.save();

    res.json({ success: true, message: "Variant updated successfully" });
  } catch (error) {
    console.error("Error editing variant:", error);
    res.status(500).json({ success: false, message: "Server error while updating variant" });
  }
};

// POST /admin/products/:productId/variants/:variantId/delete
export const deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid Product or Variant ID" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const initialLength = product.variants.length;
    product.variants = product.variants.filter(
      v => !((v._id && v._id.toString() === variantId.toString()) || (v.id && v.id.toString() === variantId.toString()))
    );

    if (product.variants.length === initialLength) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    await product.save();

    res.json({ success: true, message: "Variant deleted successfully" });
  } catch (error) {
    console.error("Error deleting variant:", error);
    res.status(500).json({ success: false, message: "Server error while deleting variant" });
  }
};