// Mock User Model - Replace with your actual Mongoose User model
// import User from '../../models/User.js';

/**
 * Render the Profile Page
 */
export const getProfile = async (req, res) => {
    try {
        // Assume req.user comes from your auth middleware
        // const user = await User.findById(req.user.id);
        
        const user = {
            fullname: "Muhammed Sinan",
            email: "sinan@gmail.com",
            phone: "9061181938"
        };

        res.render('user/profile', { 
            title: 'My Profile | Nafahath',
            user: user 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

/**
 * Handle Password Change (AJAX)
 */
export const changePassword = async (req, res) => {
    try {
        // Logic to send reset link or open a modal
        // For now, we return a success response for your AJAX script
        res.status(200).json({ 
            message: "A password reset link has been sent to your email." 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to process request." });
    }
};

/**
 * Handle Email Change (AJAX)
 */
export const changeEmail = async (req, res) => {
    try {
        res.status(200).json({ 
            message: "Check your new email for a verification link." 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to process email change." });
    }
};

/**
 * Update Profile Information
 */


export const updateProfilePage = (req, res) => {
  res.render("user/editProfile");
};

export const getEditProfile = async (req, res) => {
    try {
       
        res.render('user/editProfile', { 
            // user: req.user,
            title: 'Edit Profile | Nafahath' 
        });
    } catch (err) {
        console.error(err);
        res.redirect('user/profile');
    }
};







