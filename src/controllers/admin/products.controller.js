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
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();
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
    const { 
      productName, description, category, brand, 
      variantSize, stock, regularPrice, salePrice 
    } = req.body;

    if (!productName || productName.length < 3) {
      return res.redirect("/admin/addProducts").send({message: "Product Name must be at least 3 characters"});
    }
    if (!description || description.length < 10) {
      return res.redirect("/admin/addProducts?error=Description must be at least 10 characters");
    }
    if (!category || !brand) {
      return res.redirect("/admin/addProducts?error=Category and Brand are required");
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
    const productId = req.query.id;
    if (!productId) return res.redirect("/admin/products?error=Product ID is missing");
    
    const product = await Product.findById(productId);
    if (!product) return res.redirect("/admin/products?error=Product not found");
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
  try {
    const productId = req.query.id;
    if (!productId) return res.redirect("/admin/products?error=Product ID is missing");
    
    const { 
      productName, description, category, brand, 
      variantSize, stock, regularPrice, salePrice 
    } = req.body;

    if (!productName || productName.length < 3) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Product Name must be at least 3 characters`);
    }
    if (!description || description.length < 10) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Description must be at least 10 characters`);
    }
    if (!category || !brand) {
      return res.redirect(`/admin/products/edit?id=${productId}&error=Category and Brand are required`);
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) return res.redirect("/admin/products?error=Product not found");

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

    // Validate Variants
    for (const v of variants) {
      if (v.stock < 0 || !Number.isInteger(v.stock)) {
        return res.redirect(`/admin/products/${req.params.id}/edit?error=Stock cannot be negative and must be an integer`);
      }
      if (v.regularPrice <= 0) {
        return res.redirect(`/admin/products/${req.params.id}/edit?error=Regular Price must be greater than 0`);
      }
      if (v.salePrice < 0) {
        return res.redirect(`/admin/products/${req.params.id}/edit?error=Sale Price cannot be negative`);
      }
      if (v.salePrice > 0 && v.salePrice >= v.regularPrice) {
        return res.redirect(`/admin/products/${req.params.id}/edit?error=Sale Price must be less than Regular Price`);
      }
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
    res.redirect(`/admin/products/edit?id=${req.query.id}&error=Failed to update product`);
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