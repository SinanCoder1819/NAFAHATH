
import Category from "../../models/Category.model.js";

const PAGE_SIZE = 5;

export const getCategories = async (req,res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const search = (req.query.search || "").trim()

    const filter = {}

    
    if(search){

      const safeSearch = escapeRegex(search);

      filter.$or = [
        {name: {$regex: safeSearch, $options: "i"}},
        {description: {$regex: safeSearch, $options: "i"}},
      ];
    }

    
    const totalCategories = await Category.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(totalCategories / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)


    if (page < 1) {
      return res.redirect(`/admin/categories?page=1`);
    }


     if (page > totalPages ) {
      return res.redirect(`/admin/categories?page=${totalPages}`);
    }

    
    

    
    const categories = await Category.find(filter)
    .sort({createdAt: -1})
    .skip((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)


   


    res.render("admin/categories", {
      layout: "layouts/admin",
      admin: req.session.admin,
      activePage: "categories",
      categories,
      search,
      currentPage,
      totalPages,
      totalCategories,
      pageSize: PAGE_SIZE,
      error: req.query.error || "",
      success: req.query.success || "",
    })
  } catch (error) {
    console.error(error)
    res.status(500).send("Server error");
  }
}



export const addCategory = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const description = (req.body.description || "").trim();

    

    const isActive = req.body.isActive === "true" || req.body.isActive === "on";
    
    console.log(isActive)

    if (!name || name.length < 3 || name.length > 50) {
     return res.redirect("/admin/categories?error=Category name must be between 3 and 50 characters");
    }

    const nameRegex = /^[A-Za-z0-9\s\-&]+$/;

    if (!nameRegex.test(name)) {
      return res.redirect("/admin/categories?error=Category name can only contain letters, numbers, spaces, -, and &.");
    }


    if (!description || description.length < 10) {
      return res.redirect("/admin/categories?error=Description must be at least 10 characters long.");
    }

    const existingCategory = await Category.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    

    if (existingCategory) {
      return res.redirect("/admin/categories?error=Category already exists");
    }

    
    await Category.create({
      name,
      description,
      isDeleted: !isActive,     
    });

    res.redirect("/admin/categories?success=Category added successfully");
  } catch (err) {
    console.error("addCategory error:", err);

    res.redirect("/admin/categories?error=Failed to add category");
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const name = (req.body.name || "").trim();
    const description = (req.body.description || "").trim();
    
    
    
    const isActive = req.body.isActive === "true" || req.body.isActive === "on";

    if (!name || name.length < 3 || name.length > 50) {
      return res.redirect("/admin/categories?error=Category name must be between 3 and 50 characters.");
    }
    const nameRegex = /^[A-Za-z0-9\s\-&]+$/;

    if (!nameRegex.test(name)) {
      return res.redirect("/admin/categories?error=Category name can only contain letters, numbers, spaces, -, and &.");
    }
    if (!description || description.length < 10) {
      return res.redirect("/admin/categories?error=Description must be at least 10 characters long.");
    }

    const duplicateCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });

    if (duplicateCategory) {
      return res.redirect("/admin/categories?error=Category already exists");
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.redirect("/admin/categories?error=Category not found");
    }

    category.name = name;
    category.description = description;
    category.isDeleted = !isActive;

    await category.save();

    res.redirect("/admin/categories?success=Category updated successfully");
  } catch (err) {
    console.error("updateCategory error:", err);
    
    res.redirect("/admin/categories?error=Failed to update category");
  }
};

export const softDeleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

   

    if (!category) {
      return res.redirect("/admin/categories?error=Category not found");
    }

    category.isDeleted = true;
    await category.save();

    res.redirect("/admin/categories?success=Category deleted successfully");
  } catch (err) {
    console.error("softDeleteCategory error:", err);
    res.redirect("/admin/categories?error=Failed to delete category");
  }
};

export const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.redirect("/admin/categories?error=Category not found");
    }

    category.isDeleted = false;
    await category.save();

    res.redirect("/admin/categories?success=Category restored successfully");
  } catch (err) {
    console.error("restoreCategory error:", err);
    res.redirect("/admin/categories?error=Failed to restore category");
  }
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}