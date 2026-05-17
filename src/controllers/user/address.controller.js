import Address from '../../models/Address.model.js';

const getSessionUserId = (req) => req.session.user?.id || req.session.user?._id;

// GET /address
export const getAddressPage = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
        res.render('user/address', {
            title: 'My Addresses | Nafahath',
            addresses
        });
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// POST /address — Add new address
export const addAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { fullName, addressLine, city, state, postalCode, phone, isDefault } = req.body;

        // Validation
        if (!fullName || !addressLine || !city || !state || !postalCode || !phone) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (!/^[0-9]{6}$/.test(postalCode)) {
            return res.status(400).json({ message: 'Postal code must be 6 digits.' });
        }
        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({ message: 'Phone number must be 10 digits.' });
        }

        const setDefault = isDefault === true || isDefault === 'true';

        // If setting as default, unset all others first
        if (setDefault) {
            await Address.updateMany({ userId }, { $set: { isDefault: false } });
        }

        // If this is the first address, auto-set as default
        const count = await Address.countDocuments({ userId });
        const shouldBeDefault = setDefault || count === 0;

        const address = await Address.create({
            userId,
            fullName: fullName.trim(),
            addressLine: addressLine.trim(),
            city: city.trim(),
            state: state.trim(),
            postalCode: postalCode.trim(),
            phone: phone.trim(),
            isDefault: shouldBeDefault
        });

        return res.status(201).json({ message: 'Address added successfully.', address });
    } catch (error) {
        console.error('Add address error:', error);
        return res.status(500).json({ message: 'Failed to add address.' });
    }
};

// PUT /address/:id — Edit address
export const editAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;
        const { fullName, addressLine, city, state, postalCode, phone, isDefault } = req.body;

        if (!fullName || !addressLine || !city || !state || !postalCode || !phone) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (!/^[0-9]{6}$/.test(postalCode)) {
            return res.status(400).json({ message: 'Postal code must be 6 digits.' });
        }
        if (!/^[0-9]{10}$/.test(phone)) {
            return res.status(400).json({ message: 'Phone number must be 10 digits.' });
        }

        const address = await Address.findOne({ _id: id, userId });
        if (!address) return res.status(404).json({ message: 'Address not found.' });

        const setDefault = isDefault === true || isDefault === 'true';

        if (setDefault) {
            await Address.updateMany({ userId }, { $set: { isDefault: false } });
        }

        address.fullName = fullName.trim();
        address.addressLine = addressLine.trim();
        address.city = city.trim();
        address.state = state.trim();
        address.postalCode = postalCode.trim();
        address.phone = phone.trim();
        address.isDefault = setDefault;
        await address.save();

        return res.status(200).json({ message: 'Address updated successfully.', address });
    } catch (error) {
        console.error('Edit address error:', error);
        return res.status(500).json({ message: 'Failed to update address.' });
    }
};

// DELETE /address/:id — Remove address
export const deleteAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;

        const address = await Address.findOneAndDelete({ _id: id, userId });
        if (!address) return res.status(404).json({ message: 'Address not found.' });

        // If deleted address was default, set the next one as default
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

// PATCH /address/:id/set-default
export const setDefaultAddress = async (req, res) => {
    try {
        const userId = getSessionUserId(req);
        const { id } = req.params;

        await Address.updateMany({ userId }, { $set: { isDefault: false } });
        const address = await Address.findOneAndUpdate(
            { _id: id, userId },
            { $set: { isDefault: true } },
            { new: true }
        );

        if (!address) return res.status(404).json({ message: 'Address not found.' });

        return res.status(200).json({ message: 'Default address updated.' });
    } catch (error) {
        console.error('Set default error:', error);
        return res.status(500).json({ message: 'Failed to set default address.' });
    }
};
