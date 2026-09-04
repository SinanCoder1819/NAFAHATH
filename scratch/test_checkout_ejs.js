import ejs from "ejs";
import path from "path";
import fs from "fs";

const templatePath = path.resolve("src/views/user/checkout.ejs");
console.log("Reading template from:", templatePath);

const templateContent = fs.readFileSync(templatePath, "utf-8");

const mockData = {
  title: "Checkout | Nafahath Perfumes",
  addresses: [
    {
      _id: "65dfd5c41bc2222a0453d111",
      fullName: "Test User",
      addressLine: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      phone: "9876543210",
      isDefault: true
    }
  ],
  items: [
    {
      productId: "mock-prod-1",
      variantId: "mock-var-1",
      productName: "Oud Noir Impérial",
      brand: "Nafahath Signature",
      primaryImage: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=300&q=80",
      size: "100ml",
      quantity: 1,
      price: 2499,
      totalPrice: 2499,
      regularPrice: 2499,
      hasDiscount: false,
      discountPercent: 0
    }
  ],
  originalSubtotal: 2499,
  productDiscount: 0,
  subtotal: 2499,
  discount: 200,
  shipping: 99,
  taxes: 450,
  finalTotal: 2398,
  isMockData: true,
  // Common header/layout variables
  cartCount: 1,
  user: {
    name: "Test User",
    email: "testuser@example.com"
  }
};

try {
  console.log("Compiling EJS template...");
  const html = ejs.render(templateContent, mockData, {
    filename: templatePath,
    views: [path.resolve("src/views")]
  });
  console.log("Success! Compiled successfully without errors.");
} catch (error) {
  console.error("Compilation Error found:\n", error);
}
