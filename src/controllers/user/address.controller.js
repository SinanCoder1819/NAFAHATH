import { json } from 'express';
import Address from '../../models/Address.model.js';
import { validateName, validatePhone, validatePincode } from '../../utils/validators.js';

const getSessionUserId = (req) => req.session.user?.id || req.session.user?._id;

// GET /address
export const getAddressPage = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
        res.render('user/address', {title: 'My Addresses | Nafahath',addresses});
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).send('Internal Server Error');
    }
};


export const addAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { fullName, addressLine, city, state, postalCode, phone, isDefault } = req.body;

        // Validation
        if (!fullName || !addressLine || !city || !state || !postalCode || !phone) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        

        const nameCheck = validateName(fullName);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.message });
        }
        const pinCheck = validatePincode(postalCode);
        if (!pinCheck.valid) {
            return res.status(400).json({ message: pinCheck.message });
        }
        const phoneCheck = validatePhone(phone);
        if (!phoneCheck.valid) {
            return res.status(400).json({ message: phoneCheck.message });
        }

        const setDefault = isDefault === true || isDefault === 'true';

      
        if (setDefault) {
            await Address.updateMany({ userId }, { $set: { isDefault: false } });
        }


       
        const count = await Address.countDocuments({ userId });
        const shouldBeDefault = setDefault || count === 0;

        

        const address = await Address.create({
            userId,
            fullName: nameCheck.value,
            addressLine: addressLine.trim(),
            city: city.trim(),
            state: state.trim(),
            postalCode: pinCheck.value,
            phone: phoneCheck.value,
            isDefault: shouldBeDefault
        });

    

        return res.status(201).json({ message: 'Address added successfully.', address });
    } catch (error) {
        console.error('Add address error:', error);
        return res.status(500).json({ message: 'Failed to add address.' });
    }
};


export const editAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;
        const { fullName, addressLine, city, state, postalCode, phone, isDefault } = req.body;

        if (!fullName || !addressLine || !city || !state || !postalCode || !phone) {
            return res.status(400).json({ message: 'All fields are required.' });
        }


        

        const nameCheck = validateName(fullName);
        if (!nameCheck.valid) {
            return res.status(400).json({ message: nameCheck.message });
        }
        const pinCheck = validatePincode(postalCode);
        if (!pinCheck.valid) {
            return res.status(400).json({ message: pinCheck.message });
        }
        const phoneCheck = validatePhone(phone);
        if (!phoneCheck.valid) {
            return res.status(400).json({ message: phoneCheck.message });
        }

        const address = await Address.findOne({ _id: id, userId });
        if (!address) return res.status(404).json({ message: 'Address not found.' });

        const setDefault = isDefault === true || isDefault === 'true';

        if (setDefault) {
            await Address.updateMany({ userId }, { $set: { isDefault: false } });
        }

        address.fullName = nameCheck.value;
        address.addressLine = addressLine.trim();
        address.city = city.trim();
        address.state = state.trim();
        address.postalCode = pinCheck.value;
        address.phone = phoneCheck.value;
        address.isDefault = setDefault;
        await address.save();

        return res.status(200).json({ message: 'Address updated successfully.', address });
    } catch (error) {
        console.error('Edit address error:', error);
        return res.status(500).json({ message: 'Failed to update address.' });
    }
};


export const deleteAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;

        const address = await Address.findOneAndDelete({ _id: id, userId });
        if (!address) return res.status(404).json({ message: 'Address not found.' });

        
        if (address.isDefault) {
            const next = await Address.findOne({ userId }).sort({ createdAt: -1 });
            if (next) {
                next.isDefault = true;
                await next.save();
            }
        }

        return res.status(200).json({ message: 'Address removed successfully.' });
    } catch (error) {
        console.error('Delete address error:', error);
        return res.status(500).json({ message: 'Failed to remove address.' });
    }
};


export const setDefaultAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;

        await Address.updateMany({ userId }, { $set: { isDefault: false } });
        const address = await Address.findOneAndUpdate(
            { _id: id, userId },
            { $set: { isDefault: true } },
            { returnDocument: 'after' }
        );

        if (!address) return res.status(404).json({ message: 'Address not found.' });

        return res.status(200).json({ message: 'Default address updated.' });
    } catch (error) {
        console.error('Set default error:', error);
        return res.status(500).json({ message: 'Failed to set default address.' });
    }
};
