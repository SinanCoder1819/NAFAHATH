import Product from "../../models/Product.model.js";
import User from "../../models/User.model.js";
import Category from "../../models/Category.model.js";

export const getProductsDetail = async (req, res) => {
    try {
        const productId = req.params.id;
        
          
        const product = await Product.findById(productId).lean();
        
        if (!product || product.isDeleted) {
            return res.redirect('/shop'); 
        }

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id },
            isDeleted: false
        })
        .limit(4)
        .lean();

       
        let inWishlist = false;
        const userId = (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));
        if (userId) {
            const userDoc = await User.findById(userId).select('wishlist').lean();
            if (userDoc && userDoc.wishlist) {
                inWishlist = userDoc.wishlist.map(id => id.toString()).includes(product._id.toString());
            }
        }

        res.render('user/productDetail', { 
            product: product, 
            relatedProducts: relatedProducts,
            inWishlist: inWishlist
        });
        
    } catch (error) {
        console.error("Error loading product details:", error);
        res.redirect('/');
    }
};


export const getShopPage = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 9; 
        
        let filter = { isDeleted: false };

        
        // i. Search logic
        const search = req.query.search ? req.query.search.trim() : "";
        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } }
            ];
        }

        const category = req.query.category || "";
        if (category) {
            filter.category = { $regex: `^${category}$`, $options: "i" };
        }

        const brand = req.query.brand || "";
        if (brand) {
            filter.brand = brand;
        }

        

        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            let priceConditions = [];
            
            let salePriceMatch = { $gt: 0 };
            if (!isNaN(minPrice)) salePriceMatch.$gte = minPrice;
            if (!isNaN(maxPrice)) salePriceMatch.$lte = maxPrice;
            priceConditions.push({ salePrice: salePriceMatch });
            
            let regularPriceMatch = {};
            if (!isNaN(minPrice)) regularPriceMatch.$gte = minPrice;
            if (!isNaN(maxPrice)) regularPriceMatch.$lte = maxPrice;
            priceConditions.push({ regularPrice: regularPriceMatch, salePrice: { $in: [0, null] } });
            
            filter.variants = { $elemMatch: { $or: priceConditions } };
        }

        const sortQuery = req.query.sort || "newest";
        let sortOption = {};
        if (sortQuery === "newest") {
            sortOption = { createdAt: -1 };
        } else if (sortQuery === "priceAsc") {
            sortOption = { "variants.0.regularPrice": 1 }; 
        } else if (sortQuery === "priceDesc") {
            sortOption = { "variants.0.regularPrice": -1 };
        } else if (sortQuery === "aToZ") {
            sortOption = { productName: 1 };
        } else if (sortQuery === "zToA") {
            sortOption = { productName: -1 };
        }

        // ii & v. Pagination & Combined filtering
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
        const currentPage = Math.min(page, totalPages);

        const products = await Product.find(filter)
            .sort(sortOption)
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .lean();

        const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

        

        // Pass everything to the view
        res.render("user/shop", {
            products: products,
            categories: categories,
            currentPage: currentPage,
            totalPages: totalPages,
            search: search,
            category: category,
            brand: brand,
            minPrice: minPrice,
            maxPrice: maxPrice,
            sort: sortQuery
        });
        
    } catch (error) {
        console.error("Error fetching products:", error);
        res.redirect("/");
    }
};