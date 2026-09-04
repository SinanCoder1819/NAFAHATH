import Product from "../../models/Product.model.js";
import User from "../../models/User.model.js";
import Category from "../../models/Category.model.js";
import Wishlist from "../../models/Wishlist.model.js";
import Cart from "../../models/Cart.model.js";

const getUserIdFromReq = (req, res) => {
    return (res && res.locals && res.locals.user && res.locals.user._id) ||
           (req.user && (req.user._id || req.user.id)) ||
           (req.session && req.session.user && (req.session.user._id || req.session.user.id));
};

export const getProductsDetail = async (req, res) => {
    try {
        const productId = req.params.id;
        
          
        const product = await Product.findById(productId).lean();
        
        if (!product) {
            return res.redirect('/shop'); 
        }

        

        let relatedProducts = await Product.find({
            category: { $regex: `^${product.category}$`, $options: "i" },
            _id: { $ne: product._id },
            isDeleted: false
        })
        .limit(4)
        .lean();

        if (relatedProducts.length < 4) {
            const excludeIds = [product._id, ...relatedProducts.map(p => p._id)];
            const backfill = await Product.find({
                _id: { $nin: excludeIds },
                isDeleted: false
            })
            .limit(4 - relatedProducts.length)
            .lean();
            relatedProducts = [...relatedProducts, ...backfill];
        }

       
        let inWishlist = false;
        let cartVariantIds = [];
        const userId = getUserIdFromReq(req, res);
        if (userId) {
            // Get wishlist state
            const wishlistDoc = await Wishlist.findOne({ userId }).lean();
            if (wishlistDoc && wishlistDoc.products) {
                const wishListIds = wishlistDoc.products.map(p => {
                    if (!p) return '';
                    if (p._id) return p._id.toString();
                    return p.toString();
                }).filter(Boolean);
                inWishlist = wishListIds.includes(product._id.toString());
            }

            // Get cart state
            const cartDoc = await Cart.findOne({ userId }).lean();
            if (cartDoc && cartDoc.items) {
                cartVariantIds = cartDoc.items
                    .filter(item => item.productId && item.productId.toString() === productId.toString())
                    .map(item => item.variantId ? item.variantId.toString() : '');
            }
        }

        res.render('user/productDetail', { 
            product: product, 
            relatedProducts: relatedProducts,
            inWishlist: inWishlist,
            cartVariantIds: cartVariantIds
        });
        
    } catch (error) {
        console.error("Error loading product details:", error);
        res.redirect('/');
    }
};


export const getShopPage = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 6; 
        
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
        } else if (sortQuery === "aToZ") {
            sortOption = { productName: 1 };
        } else if (sortQuery === "zToA") {
            sortOption = { productName: -1 };
        }

        // ii & v. Pagination & Combined filtering
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
        const currentPage = Math.min(page, totalPages);

        let products;
        if (sortQuery === "priceAsc" || sortQuery === "priceDesc") {
            const sortDir = sortQuery === "priceAsc" ? 1 : -1;
            const aggregatePipeline = [
                { $match: filter },
                {
                    $addFields: {
                        firstVariant: { $arrayElemAt: ["$variants", 0] }
                    }
                },
                {
                    $addFields: {
                        effectivePrice: {
                            $cond: {
                                if: { 
                                    $and: [
                                        { $not: { $eq: ["$firstVariant", null] } },
                                        { $gt: ["$firstVariant.salePrice", 0] }
                                    ]
                                },
                                then: "$firstVariant.salePrice",
                                else: { $ifNull: ["$firstVariant.regularPrice", 0] }
                            }
                        }
                    }
                },
                { $sort: { effectivePrice: sortDir, productName: 1 } },
                { $skip: (currentPage - 1) * limit },
                { $limit: limit }
            ];
            products = await Product.aggregate(aggregatePipeline);
        } else {
            products = await Product.find(filter)
                .sort(sortOption)
                .skip((currentPage - 1) * limit)
                .limit(limit)
                .lean();
        }

        const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();

        let wishlistProductIds = [];
        let cartProductIds = [];
        const userId = getUserIdFromReq(req, res);
        if (userId) {
            const wishlistDoc = await Wishlist.findOne({ userId }).lean();
            if (wishlistDoc && wishlistDoc.products) {
                wishlistProductIds = wishlistDoc.products.map(p => {
                    if (!p) return '';
                    if (p._id) return p._id.toString();
                    return p.toString();
                }).filter(Boolean);
            }

            const cartDoc = await Cart.findOne({ userId }).lean();
            if (cartDoc && cartDoc.items) {
                cartProductIds = cartDoc.items.map(item => item.productId ? item.productId.toString() : '').filter(Boolean);
            }
        }

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
            sort: sortQuery,
            wishlistProductIds: wishlistProductIds,
            cartProductIds: cartProductIds
        });
        
    } catch (error) {
        console.error("Error fetching products:", error);
        res.redirect("/");
    }
};