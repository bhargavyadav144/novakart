import mongoose from 'mongoose';

const termsAndConditionsSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['customer', 'seller', 'delivery', 'general'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    required: true,
    default: '1.0'
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  summary: {
    type: String,
    default: 'Initial policy terms published.'
  },
  fullText: {
    type: String,
    required: true
  },
  sections: [
    {
      title: { type: String, required: true },
      content: { type: String, required: true }
    }
  ],
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export const TermsAndConditions = mongoose.models.TermsAndConditions || mongoose.model('TermsAndConditions', termsAndConditionsSchema);
