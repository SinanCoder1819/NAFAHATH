import Product from "../../models/Product.model.js";
import User from "../../models/User.model.js";

export const getProductsDetail = async (req, res) => {
    try {
        // 1. Get the product ID from the URL (e.g. /productDetail/64a2b3...)
        const productId = req.params.id;
        
        // 2. Fetch the main product from the database
        // .lean() makes the database object a standard Javascript object which is faster for EJS
        const product = await Product.findById(productId).lean();
        
        if (!product || product.isDeleted) {
            // Redirect to shop if product doesn't exist or is blocked/deleted
            return res.redirect('/shop'); 
        }

        // 3. Fetch 4 Related Products from the SAME category (excluding the current product)
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id } // Do not show the current product in 'Related'
        })
        .limit(4)
        .lean();

        // 4. Check if the product is in the user's wishlist
        let inWishlist = false;
        const userId = (req.user && req.user._id) || (req.session && req.session.user && (req.session.user._id || req.session.user.id));
        if (userId) {
            const userDoc = await User.findById(userId).select('wishlist').lean();
            if (userDoc && userDoc.wishlist) {
                inWishlist = userDoc.wishlist.map(id => id.toString()).includes(product._id.toString());
            }
        }

        // 5. Render the EJS page and pass the data!
        // We do not need to pass 'user' because your locals.middleware.js already handles it!
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
        
        // vi. Hide blocked/deleted products
        let filter = { isDeleted: false };
        
        // i. Search logic
        const search = req.query.search ? req.query.search.trim() : "";
        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } }
            ];
        }

        // iv. Category Filter
        const category = req.query.category || "";
        if (category) {
            filter.category = category;
        }

        // iv. Brand Filter (NEW)
        const brand = req.query.brand || "";
        if (brand) {
            filter.brand = brand;
        }

        // iv. Price Range Filter (NEW)
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            let priceConditions = [];
            
            // Condition 1: On Sale (salePrice > 0 and within min/max)
            let salePriceMatch = { $gt: 0 };
            if (!isNaN(minPrice)) salePriceMatch.$gte = minPrice;
            if (!isNaN(maxPrice)) salePriceMatch.$lte = maxPrice;
            priceConditions.push({ salePrice: salePriceMatch });
            
            // Condition 2: Not on sale (salePrice is 0 or missing, regularPrice within min/max)
            let regularPriceMatch = {};
            if (!isNaN(minPrice)) regularPriceMatch.$gte = minPrice;
            if (!isNaN(maxPrice)) regularPriceMatch.$lte = maxPrice;
            priceConditions.push({ regularPrice: regularPriceMatch, salePrice: { $in: [0, null] } });
            
            filter.variants = { $elemMatch: { $or: priceConditions } };
        }

        // iii. Sorting logic
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

        res.render("user/shop", {
            products,
            search,
            category,
            brand,         // Added brand to pass back to frontend
            minPrice,      // Added minPrice to pass back to frontend
            maxPrice,      // Added maxPrice to pass back to frontend
            sort: sortQuery,
            currentPage,
            totalPages
        });
        
    } catch (error) {
        console.error("Error loading shop page:", error);
        res.redirect('/');
    }
};