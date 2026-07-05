import Product from "../../models/Product.model.js";

const PAGE_SIZE = 10;

const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const getProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || "").trim();
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

export const getAddProduct = (req, res) => {
  res.render("admin/addProducts", {
    layout: "layouts/admin",
    admin: req.session.admin,
    activePage: "products",
    error: req.query.error || "",
  });
};

export const postAddProduct = async (req, res) => {
  try {
    const { 
      productName, description, category, brand, 
      variantSize, stock, regularPrice, salePrice 
    } = req.body;

    // Basic Validation - Redirects properly to /admin/addProducts
    if (!productName || !category || !brand) {
      return res.redirect("/admin/addProducts?error=Please fill all required fields");
    }

    const variants = [];
    if (Array.isArray(variantSize)) {
      for (let i = 0; i < variantSize.length; i++) {
        variants.push({
          size: variantSize[i],
          stock: Number(stock[i]) || 0,
          regularPrice: Number(regularPrice[i]) || 0,
          salePrice: Number(salePrice[i]) || 0
        });
      }
    } else if (variantSize) {
      variants.push({
        size: variantSize,
        stock: Number(stock) || 0,
        regularPrice: Number(regularPrice) || 0,
        salePrice: Number(salePrice) || 0
      });
    }

    let primaryImage = "";
    const galleryImages = [];

    if (req.files) {
      for (let i = 1; i <= 4; i++) {
        const fieldName = `galleryImage${i}`;
        if (req.files[fieldName] && req.files[fieldName].length > 0) {
          galleryImages.push(req.files[fieldName][0].secure_url); 
        }
      }
      
      // Secretly set the primary image to the first gallery image
      if (galleryImages.length > 0) {
          primaryImage = galleryImages[0];
      }
    }

    const newProduct = new Product({
      productName, description, category, brand, variants, primaryImage, galleryImages
    });

    await newProduct.save();
    res.redirect("/admin/products?success=Product added successfully");
  } catch (error) {
    console.error("Error adding product:", error);
    res.redirect("/admin/addProducts?error=Failed to add product");
  }
};

export const getEditProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/admin/products?error=Product not found");
    res.render("admin/editProducts", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "products",
      product: product,
      error: req.query.error || "",
    });
  } catch (error) {
    console.error("Error fetching product for edit:", error);
    res.redirect("/admin/products?error=Server error");
  }
};

export const postEditProduct = async (req, res) => {
  try {
    const { 
      productName, description, category, brand, 
      variantSize, stock, regularPrice, salePrice 
    } = req.body;
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.redirect("/admin/products?error=Product not found");
    }

    const variants = [];
    if (Array.isArray(variantSize)) {
      for (let i = 0; i < variantSize.length; i++) {
        variants.push({
          size: variantSize[i],
          stock: Number(stock[i]) || 0,
          regularPrice: Number(regularPrice[i]) || 0,
          salePrice: Number(salePrice[i]) || 0
        });
      }
    } else if (variantSize) {
      variants.push({
        size: variantSize,
        stock: Number(stock) || 0,
        regularPrice: Number(regularPrice) || 0,
        salePrice: Number(salePrice) || 0
      });
    }

    if (req.files) {
      // If they uploaded NEW gallery images, replace them at the correct index
      for (let i = 1; i <= 4; i++) {
        const fieldName = `galleryImage${i}`;
        if (req.files[fieldName] && req.files[fieldName].length > 0) {
          existingProduct.galleryImages[i-1] = req.files[fieldName][0].secure_url; 
        }
      }
    }
    
    // Secretly set primaryImage to the first gallery image
    let primaryImage = existingProduct.primaryImage;
    if (existingProduct.galleryImages && existingProduct.galleryImages.length > 0) {
        primaryImage = existingProduct.galleryImages[0];
    }

    existingProduct.productName = productName;
    existingProduct.description = description;
    existingProduct.category = category;
    existingProduct.brand = brand;
    existingProduct.variants = variants;
    existingProduct.primaryImage = primaryImage;
    await existingProduct.save();
    res.redirect("/admin/products?success=Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    res.redirect(`/admin/products/edit/${req.params.id}?error=Failed to update product`);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products?success=Product deleted successfully");
  } catch (error) {
    console.error("Error deleting product:", error);
    res.redirect("/admin/products?error=Failed to delete product");
  }
};