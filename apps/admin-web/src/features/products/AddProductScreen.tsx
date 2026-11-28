import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getMediaUrl } from '../../lib/api';
import { CustomSelect } from '../../components/ui';
import {
  Package,
  ArrowLeft,
  ArrowRight,
  Save,
  Tag,
  DollarSign,
  Boxes,
  Eye,
  Check,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Image as ImageIcon,
  FileText,
  Loader2,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  X,
  Edit2,
  Video,
  Film,
  Play,
  PlayCircle,
  ChevronDown,
} from 'lucide-react';
import { inrToPaise, validateTierPricing } from '@necessity/shared';

export type StepKey = 'basic' | 'pricing' | 'inventory' | 'availability';

interface StepConfig {
  key: StepKey;
  stepNumber: number;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  { key: 'basic', stepNumber: 1, title: '1. Basic Information', shortTitle: 'Basic Info', icon: Tag },
  { key: 'pricing', stepNumber: 2, title: '2. Pricing & Tax', shortTitle: 'Pricing & Tax', icon: DollarSign },
  { key: 'inventory', stepNumber: 3, title: '3. Inventory & Stock', shortTitle: 'Inventory & Stock', icon: Boxes },
  { key: 'availability', stepNumber: 4, title: '4. Availability & Visibility', shortTitle: 'Availability', icon: Eye },
];

export const AddProductScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<StepKey>('basic');
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states - Step 1: Basic Information & Images
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [productCode, setProductCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('Necessity India');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<Array<{ url: string; isPrimary: boolean; altText?: string }>>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Form states - Step 1: Product Videos
  const [videos, setVideos] = useState<Array<{ url: string; title?: string; thumbnailUrl?: string; durationSeconds?: number }>>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [activePreviewVideo, setActivePreviewVideo] = useState<{ url: string; title?: string } | null>(null);

  // Form states - Step 2: Pricing, Tax & Tier Pricing
  const [mrpRupees, setMrpRupees] = useState('299');
  const [dealerPriceRupees, setDealerPriceRupees] = useState('189');
  const [gstRatePercent, setGstRatePercent] = useState<number>(18);
  const [hsnCode, setHsnCode] = useState('6302');
  const [uom, setUom] = useState('PCS');
  const [packSize, setPackSize] = useState('1');
  const [minOrderQuantity, setMinOrderQuantity] = useState('1');
  const [orderQuantityMultiple, setOrderQuantityMultiple] = useState('1');
  const [isTierPricingEnabled, setIsTierPricingEnabled] = useState(false);
  const [isBulkDiscountsExpanded, setIsBulkDiscountsExpanded] = useState(false);
  const [tierPricing, setTierPricing] = useState<
    Array<{ minQuantity: number; maxQuantity?: number; unitPriceRupees: string }>
  >([]);

  // Form states - Step 3: Inventory, Stock & Variants
  const [stockOnHand, setStockOnHand] = useState('100');
  const [warehouseLocation, setWarehouseLocation] = useState('Main Central Warehouse');
  const [lowStockThreshold, setLowStockThreshold] = useState('15');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<Array<any>>([]);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [varSku, setVarSku] = useState('');
  const [varName, setVarName] = useState('');
  const [varAttributes, setVarAttributes] = useState<Array<{ key: string; value: string }>>([
    { key: 'Size', value: '' },
  ]);
  const [varStock, setVarStock] = useState('0');
  const [varDealerPrice, setVarDealerPrice] = useState('');
  const [varMrp, setVarMrp] = useState('');
  const [varBarcode, setVarBarcode] = useState('');
  const [varIsActive, setVarIsActive] = useState(true);

  // Form states - Step 4: Availability & Visibility
  const [isActive, setIsActive] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [visibilityInMobile, setVisibilityInMobile] = useState(true);

  // Quick inline creation modals
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isNewBrandOpen, setIsNewBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get('/products/categories');
      return res.data.data;
    },
  });

  // Fetch Brands
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await apiClient.get('/products/brands');
      return res.data.data;
    },
  });

  // Memoized unique brand options (prevents duplicates like 'Necessity India')
  const brandOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();

    const addBrand = (name: string) => {
      const trimmed = name?.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ value: trimmed, label: trimmed });
      }
    };

    // Add brands from database first
    brands.forEach((b: any) => {
      if (b?.name) addBrand(b.name);
    });

    // Add fallback options only if not already present
    addBrand('Necessity India');
    addBrand('Generic');

    return list;
  }, [brands]);

  // Fetch existing product if in Edit Mode
  const { data: existingProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await apiClient.get(`/products/${id}`);
      return res.data.data;
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name || '');
      setSku(existingProduct.sku || '');
      setProductCode(existingProduct.productCode || '');
      setBarcode(existingProduct.barcode || '');
      setCategoryId(existingProduct.categoryId || '');
      setBrand(existingProduct.brand || 'Necessity India');
      setDescription(existingProduct.description || '');
      setImages(existingProduct.images || []);
      setVideos(existingProduct.videos || []);
      setMrpRupees(String((existingProduct.mrpPaise || 0) / 100));
      setDealerPriceRupees(String((existingProduct.dealerPricePaise || 0) / 100));
      setGstRatePercent(existingProduct.gstRatePercent ?? 18);
      setHsnCode(existingProduct.hsnCode || '6302');
      setUom(existingProduct.uom || 'PCS');
      setPackSize(String(existingProduct.packSize || 1));
      setMinOrderQuantity(String(existingProduct.minOrderQuantity || 1));
      setOrderQuantityMultiple(String(existingProduct.orderQuantityMultiple || 1));
      setStockOnHand(String(existingProduct.stockOnHand || 0));
      setWarehouseLocation(existingProduct.warehouseLocation || 'Main Central Warehouse');
      setLowStockThreshold(String(existingProduct.lowStockThreshold || 10));
      setBatchNumber(existingProduct.batchNumber || '');
      setExpiryDate(existingProduct.expiryDate ? existingProduct.expiryDate.slice(0, 10) : '');
      setIsActive(existingProduct.isActive ?? true);
      setIsDraft(existingProduct.isDraft ?? false);
      setVisibilityInMobile(existingProduct.visibilityInMobile ?? true);
      if (existingProduct.hasVariants || (Array.isArray(existingProduct.variants) && existingProduct.variants.length > 0)) {
        setHasVariants(true);
        setVariants(existingProduct.variants || []);
      } else {
        setHasVariants(false);
        setVariants([]);
      }
      if (existingProduct.isTierPricingEnabled) {
        setIsTierPricingEnabled(true);
        setIsBulkDiscountsExpanded(true);
        setTierPricing(
          (existingProduct.tierPricing || []).map((t: any) => ({
            minQuantity: t.minQuantity,
            maxQuantity: t.maxQuantity,
            unitPriceRupees: String((t.unitPricePaise || 0) / 100),
          }))
        );
      } else {
        setIsTierPricingEnabled(false);
        setIsBulkDiscountsExpanded(false);
        setTierPricing([]);
      }
      setCompletedSteps(new Set(['basic', 'pricing', 'inventory', 'availability']));
    }
  }, [existingProduct]);

  // Set default category if not selected
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0]._id || categories[0].id);
    }
  }, [categories, categoryId]);

  // Handle multiple image file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageUploadError(null);
    setIsUploadingImages(true);

    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!allowedTypes.includes(file.type)) {
          setImageUploadError(`File '${file.name}' is not an allowed format. Please select JPEG, PNG, WebP, or GIF.`);
          continue;
        }

        if (file.size > maxSizeBytes) {
          setImageUploadError(`File '${file.name}' exceeds the maximum allowed size of 5MB.`);
          continue;
        }

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          const res = await apiClient.post('/products/upload-image', {
            fileBase64: base64Data,
            fileName: file.name,
          });
          const serverUrl = res.data?.data?.url || base64Data;
          setImages((prev) => [
            ...prev,
            { url: serverUrl, isPrimary: prev.length === 0, altText: name || file.name },
          ]);
        } catch {
          setImages((prev) => [
            ...prev,
            { url: base64Data, isPrimary: prev.length === 0, altText: name || file.name },
          ]);
        }
      }
    } catch {
      setImageUploadError('Failed to process image files.');
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  // Handle direct image URL addition
  const handleAddImage = () => {
    if (!imageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      { url: imageUrl.trim(), isPrimary: prev.length === 0, altText: name },
    ]);
    setImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const remaining = prev.filter((_, i) => i !== index);
      if (prev[index]?.isPrimary && remaining.length > 0) {
        remaining[0].isPrimary = true;
      }
      return remaining;
    });
  };

  const handleSetPrimary = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      }))
    );
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    setImages((prev) => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Helper to parse embeddable video URL (YouTube / Vimeo / Direct)
  const getEmbedVideoUrl = (url: string): { isEmbed: boolean; embedUrl: string } => {
    if (!url) return { isEmbed: false, embedUrl: '' };
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch) {
      return { isEmbed: true, embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch) {
      return { isEmbed: true, embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }
    return { isEmbed: false, embedUrl: url };
  };

  // Handle product video file upload (MP4, WebM, MOV, MKV up to 50MB)
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setVideoUploadError(null);
    setIsUploadingVideo(true);

    try {
      const allowedExts = /\.(mp4|webm|mov|mkv|ogg)$/i;
      const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
      const maxSizeBytes = 50 * 1024 * 1024; // 50MB

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!allowedTypes.includes(file.type) && !allowedExts.test(file.name)) {
          setVideoUploadError(`File '${file.name}' is not an allowed video format. Please select MP4, WebM, MOV, or MKV.`);
          continue;
        }

        if (file.size > maxSizeBytes) {
          setVideoUploadError(`File '${file.name}' exceeds the maximum allowed size of 50MB.`);
          continue;
        }

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          const res = await apiClient.post('/products/upload-video', {
            fileBase64: base64Data,
            fileName: file.name,
          });
          const serverUrl = res.data?.data?.url || base64Data;
          setVideos((prev) => [
            ...prev,
            {
              url: serverUrl,
              title: file.name.replace(/\.[^/.]+$/, ''),
            },
          ]);
        } catch {
          setVideos((prev) => [
            ...prev,
            {
              url: base64Data,
              title: file.name.replace(/\.[^/.]+$/, ''),
            },
          ]);
        }
      }
    } catch {
      setVideoUploadError('Failed to process video file.');
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  // Handle direct video link addition
  const handleAddVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    setVideos((prev) => [
      ...prev,
      {
        url: videoUrlInput.trim(),
        title: videoTitleInput.trim() || `Product Video ${prev.length + 1}`,
      },
    ]);
    setVideoUrlInput('');
    setVideoTitleInput('');
  };

  const handleRemoveVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveVideo = (index: number, direction: 'left' | 'right') => {
    setVideos((prev) => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Tier Pricing Handlers
  const handleAddTier = () => {
    setTierPricing((prev) => {
      const parsedMoq = Math.max(1, parseInt(minOrderQuantity, 10) || 1);
      const lastTier = prev[prev.length - 1];
      const nextMin = lastTier && lastTier.maxQuantity ? lastTier.maxQuantity + 1 : (prev.length === 0 ? parsedMoq : 1);
      const lastPrice = lastTier ? parseFloat(lastTier.unitPriceRupees) || 0 : parseFloat(dealerPriceRupees) || 120;
      const discountSuggestion = Math.max(1, Math.round(lastPrice * 0.95));
      return [
        ...prev,
        {
          minQuantity: nextMin,
          maxQuantity: nextMin + 9,
          unitPriceRupees: String(discountSuggestion),
        },
      ];
    });
  };

  const handleUpdateTier = (index: number, field: string, value: any) => {
    setTierPricing((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveTier = (index: number) => {
    setTierPricing((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplySampleTiers = () => {
    const base = parseFloat(dealerPriceRupees) || 120;
    const moqVal = Math.max(1, parseInt(minOrderQuantity, 10) || 1);
    const step1Max = Math.max(moqVal + 4, 9);
    const step2Min = step1Max + 1;
    const step2Max = Math.max(step2Min + 39, 49);
    const step3Min = step2Max + 1;
    const step3Max = Math.max(step3Min + 49, 99);
    const step4Min = step3Max + 1;

    setTierPricing([
      { minQuantity: moqVal, maxQuantity: step1Max, unitPriceRupees: String(Math.round(base)) },
      { minQuantity: step2Min, maxQuantity: step2Max, unitPriceRupees: String(Math.max(1, Math.round(base * 0.92))) },
      { minQuantity: step3Min, maxQuantity: step3Max, unitPriceRupees: String(Math.max(1, Math.round(base * 0.85))) },
      { minQuantity: step4Min, maxQuantity: undefined, unitPriceRupees: String(Math.max(1, Math.round(base * 0.78))) },
    ]);
  };

  // Variant Handlers
  const handleOpenAddVariant = () => {
    setEditingVariantIndex(null);
    setVarSku(sku ? `${sku.toUpperCase()}-V${variants.length + 1}` : `VAR-${variants.length + 1}`);
    setVarName('');
    setVarAttributes([{ key: 'Size', value: '' }]);
    setVarStock(stockOnHand || '20');
    setVarDealerPrice(dealerPriceRupees || '189');
    setVarMrp(mrpRupees || '299');
    setVarBarcode('');
    setVarIsActive(true);
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = (index: number) => {
    const v = variants[index];
    setEditingVariantIndex(index);
    setVarSku(v.sku || '');
    setVarName(v.name || '');
    const attrs = v.attributes || {};
    const attrEntries = Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) }));
    setVarAttributes(attrEntries.length > 0 ? attrEntries : [{ key: 'Size', value: '' }]);
    setVarStock(String(v.stockOnHand ?? 0));
    setVarDealerPrice(v.dealerPricePaise !== undefined ? String(v.dealerPricePaise / 100) : dealerPriceRupees);
    setVarMrp(v.mrpPaise !== undefined ? String(v.mrpPaise / 100) : mrpRupees);
    setVarBarcode(v.barcode || '');
    setVarIsActive(v.isActive ?? true);
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = () => {
    const cleanSku = varSku.trim().toUpperCase();
    if (!cleanSku) {
      alert('Variant SKU is required.');
      return;
    }

    const duplicate = variants.some((v, idx) => idx !== editingVariantIndex && v.sku?.toUpperCase() === cleanSku);
    if (duplicate) {
      alert(`Variant SKU '${cleanSku}' is already used by another variant.`);
      return;
    }

    if (cleanSku === sku.trim().toUpperCase()) {
      alert('Variant SKU cannot be identical to the parent product SKU.');
      return;
    }

    const attrsRecord: Record<string, string> = {};
    for (const attr of varAttributes) {
      if (attr.key.trim() && attr.value.trim()) {
        attrsRecord[attr.key.trim()] = attr.value.trim();
      }
    }

    if (Object.keys(attrsRecord).length === 0) {
      alert('Please specify at least one variant attribute (e.g. Size: 1 Litre).');
      return;
    }

    const autoName = varName.trim() || Object.entries(attrsRecord).map(([_, v]) => `${v}`).join(' - ');
    const stock = Math.max(0, parseInt(varStock, 10) || 0);
    const dealerP = varDealerPrice ? inrToPaise(parseFloat(varDealerPrice) || 0) : inrToPaise(parseFloat(dealerPriceRupees) || 0);

    const newVar = {
      sku: cleanSku,
      name: autoName,
      attributes: attrsRecord,
      stockOnHand: stock,
      stockReserved: editingVariantIndex !== null ? (variants[editingVariantIndex].stockReserved || 0) : 0,
      dealerPricePaise: dealerP,
      mrpPaise: dealerP,
      barcode: varBarcode.trim() || undefined,
      isActive: varIsActive,
      _id: editingVariantIndex !== null ? variants[editingVariantIndex]._id : undefined,
      id: editingVariantIndex !== null ? variants[editingVariantIndex].id : undefined,
    };

    setVariants((prev) => {
      if (editingVariantIndex !== null) {
        const copy = [...prev];
        copy[editingVariantIndex] = newVar;
        return copy;
      }
      return [...prev, newVar];
    });

    setIsVariantModalOpen(false);
  };

  const handleDeleteVariant = async (index: number) => {
    const v = variants[index];
    const variantId = v.id || v._id;

    if (isEditMode && variantId) {
      try {
        await apiClient.delete(`/products/${id}/variants/${variantId}`);
        setVariants((prev) => prev.filter((_, i) => i !== index));
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.message || 'Cannot delete variant';
        alert(`Cannot delete variant: ${errMsg}`);
      }
    } else {
      setVariants((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleToggleVariantActive = async (index: number) => {
    const v = variants[index];
    const newStatus = !v.isActive;
    const variantId = v.id || v._id;

    if (isEditMode && variantId) {
      try {
        await apiClient.patch(`/products/${id}/variants/${variantId}/status`, { isActive: newStatus });
      } catch {
        // Continue
      }
    }

    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isActive: newStatus };
      return copy;
    });
  };

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Product name is required.';
    }
    if (!sku.trim()) {
      errors.sku = 'Unique product SKU is required.';
    }
    if (!categoryId) {
      errors.categoryId = 'Please select a product category.';
    }
    if (!brand.trim()) {
      errors.brand = 'Brand name is required.';
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    const dealerPrice = parseFloat(dealerPriceRupees);

    if (isNaN(dealerPrice) || dealerPrice <= 0) {
      errors.dealerPriceRupees = 'Valid wholesale base price greater than ₹0 is required.';
    }

    if (![0, 5, 12, 18, 28].includes(Number(gstRatePercent))) {
      errors.gstRatePercent = 'Please select a valid GST rate slab (0%, 5%, 12%, 18%, or 28%).';
    }

    if (!uom.trim()) {
      errors.uom = 'Unit of measurement (UOM) is required.';
    }

    const parsedPack = parseInt(packSize, 10);
    if (isNaN(parsedPack) || parsedPack < 1) {
      errors.packSize = 'Pack size must be at least 1 unit.';
    }

    const parsedMoq = parseInt(minOrderQuantity, 10);
    if (isNaN(parsedMoq) || parsedMoq < 1) {
      errors.minOrderQuantity = 'Minimum order quantity must be at least 1.';
    }

    if (isTierPricingEnabled && tierPricing.length > 0) {
      const formatted = tierPricing.map((t) => ({
        minQuantity: Number(t.minQuantity),
        maxQuantity: t.maxQuantity ? Number(t.maxQuantity) : undefined,
        unitPricePaise: inrToPaise(parseFloat(t.unitPriceRupees) || 0),
      }));
      const baseDealerPaise = inrToPaise(dealerPrice || 0);
      const tierValidation = validateTierPricing(formatted, baseDealerPaise, parsedMoq || 1);
      if (!tierValidation.valid) {
        errors.tierPricing = tierValidation.error || 'Invalid tier pricing configuration.';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const errors: Record<string, string> = {};
    const stock = parseInt(stockOnHand, 10);
    if (isNaN(stock) || stock < 0) {
      errors.stockOnHand = 'Stock on hand must be a valid non-negative number.';
    }

    const lowStock = parseInt(lowStockThreshold, 10);
    if (isNaN(lowStock) || lowStock < 0) {
      errors.lowStockThreshold = 'Low stock alert threshold must be a valid non-negative number.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const validateStep = (step: StepKey) => {
    switch (step) {
      case 'basic':
        return validateStep1();
      case 'pricing':
        return validateStep2();
      case 'inventory':
        return validateStep3();
      case 'availability':
        return { isValid: true, errors: {} };
    }
  };

  const validateAllSteps = () => {
    const s1 = validateStep1();
    if (!s1.isValid) {
      setActiveTab('basic');
      setFieldErrors(s1.errors);
      setErrorMsg('Please complete all required fields in Step 1 (Basic Information).');
      return false;
    }
    const s2 = validateStep2();
    if (!s2.isValid) {
      setActiveTab('pricing');
      setFieldErrors(s2.errors);
      setErrorMsg('Please complete all required fields in Step 2 (Pricing & Tax).');
      return false;
    }
    const s3 = validateStep3();
    if (!s3.isValid) {
      setActiveTab('inventory');
      setFieldErrors(s3.errors);
      setErrorMsg('Please complete all required fields in Step 3 (Inventory & Stock).');
      return false;
    }
    return true;
  };

  // Step Navigation Handlers
  const handleNextFromStep1 = () => {
    const res = validateStep1();
    if (!res.isValid) {
      setFieldErrors(res.errors);
      setErrorMsg('Please complete all required fields in Basic Information.');
      return;
    }
    setFieldErrors({});
    setErrorMsg(null);
    setCompletedSteps((prev) => new Set([...prev, 'basic']));
    setActiveTab('pricing');
  };

  const handleNextFromStep2 = () => {
    const res = validateStep2();
    if (!res.isValid) {
      setFieldErrors(res.errors);
      setErrorMsg('Please complete all required fields in Pricing & Tax.');
      return;
    }
    setFieldErrors({});
    setErrorMsg(null);
    setCompletedSteps((prev) => new Set([...prev, 'pricing']));
    setActiveTab('inventory');
  };

  const handleNextFromStep3 = () => {
    const res = validateStep3();
    if (!res.isValid) {
      setFieldErrors(res.errors);
      setErrorMsg('Please complete all required fields in Inventory & Stock.');
      return;
    }
    setFieldErrors({});
    setErrorMsg(null);
    setCompletedSteps((prev) => new Set([...prev, 'inventory']));
    setActiveTab('availability');
  };

  const handleStepTabClick = (targetStep: StepKey) => {
    if (targetStep === activeTab) return;

    const stepOrder: StepKey[] = ['basic', 'pricing', 'inventory', 'availability'];
    const currentIndex = stepOrder.indexOf(activeTab);
    const targetIndex = stepOrder.indexOf(targetStep);

    // If going backwards or visiting an already completed step: always allow without loss of data!
    if (targetIndex < currentIndex || completedSteps.has(targetStep) || isEditMode) {
      setActiveTab(targetStep);
      setErrorMsg(null);
      return;
    }

    // If advancing forward: validate current step
    const currentValidation = validateStep(activeTab);
    if (!currentValidation.isValid) {
      setFieldErrors(currentValidation.errors);
      setErrorMsg('Please complete all required fields in the current step before proceeding.');
      return;
    }

    setCompletedSteps((prev) => new Set([...prev, activeTab]));

    // Check if intermediate steps need validation
    for (let i = currentIndex; i < targetIndex; i++) {
      const s = stepOrder[i];
      const val = validateStep(s);
      if (!val.isValid) {
        setActiveTab(s);
        setFieldErrors(val.errors);
        setErrorMsg(`Please complete ${STEPS.find((st) => st.key === s)?.title || s} before jumping ahead.`);
        return;
      }
    }

    setActiveTab(targetStep);
    setErrorMsg(null);
    setFieldErrors({});
  };

  // Submit mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode) {
        return apiClient.patch(`/products/${id}`, payload);
      }
      return apiClient.post('/products', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      setSuccessMsg(
        isEditMode
          ? 'Product updated successfully!'
          : res?.data?.data?.isDraft
            ? 'Product saved as draft successfully!'
            : 'Product created successfully!'
      );
      setTimeout(() => {
        navigate('/admin/products');
      }, 1200);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to save product';
      setErrorMsg(msg);
      if (msg.toLowerCase().includes('sku')) {
        setActiveTab('basic');
        setFieldErrors((prev) => ({ ...prev, sku: msg }));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const res = await apiClient.delete(`/products/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      navigate('/admin/products');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to delete product');
      setIsDeleteModalOpen(false);
    },
  });

  // Final submission action
  const handleFinalSubmit = (options?: { asDraft?: boolean }) => {
    if (saveMutation.isPending) return;
    setErrorMsg(null);

    const isSavingDraft = options?.asDraft ?? isDraft;

    if (isSavingDraft) {
      if (!name.trim()) {
        setActiveTab('basic');
        setFieldErrors({ name: 'Product name is required to save as draft.' });
        setErrorMsg('Product name is required to save as draft.');
        return;
      }
      if (!sku.trim()) {
        setActiveTab('basic');
        setFieldErrors({ sku: 'Product SKU is required to save as draft.' });
        setErrorMsg('Product SKU is required to save as draft.');
        return;
      }
    } else {
      if (!validateAllSteps()) {
        return;
      }
    }

    if (isTierPricingEnabled && tierPricing.length > 0) {
      const formattedTiers = tierPricing.map((t) => ({
        minQuantity: Number(t.minQuantity),
        maxQuantity: t.maxQuantity ? Number(t.maxQuantity) : undefined,
        unitPricePaise: inrToPaise(parseFloat(t.unitPriceRupees) || 0),
      }));
      const baseDealerPaise = inrToPaise(parseFloat(dealerPriceRupees) || 0);
      const validation = validateTierPricing(formattedTiers, baseDealerPaise);
      if (!validation.valid) {
        setActiveTab('pricing');
        setErrorMsg(validation.error || 'Invalid tier pricing configuration.');
        return;
      }
    }

    if (hasVariants && variants.length === 0) {
      setActiveTab('inventory');
      setErrorMsg('Please add at least one variant or disable variants.');
      return;
    }

    const dealerPrice = parseFloat(dealerPriceRupees) || 0;
    const mrp = parseFloat(mrpRupees) || dealerPrice;

    const payload: any = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      productCode: productCode.trim() || undefined,
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      brand: brand.trim() || 'Necessity India',
      description: description.trim() || name.trim(),
      images:
        images.length > 0
          ? images
          : [{ url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500', isPrimary: true }],
      videos: videos || [],
      mrpPaise: inrToPaise(mrp || dealerPrice),
      dealerPricePaise: inrToPaise(dealerPrice),
      gstRatePercent: Number(gstRatePercent),
      hsnCode: hsnCode.trim() || '6302',
      uom: uom.trim().toUpperCase() || 'PCS',
      packSize: Math.max(1, parseInt(packSize, 10) || 1),
      caseQuantity: existingProduct?.caseQuantity ?? 1,
      minOrderQuantity: Math.max(1, parseInt(minOrderQuantity, 10) || 1),
      orderQuantityMultiple: 1,
      stockOnHand: Math.max(0, parseInt(stockOnHand, 10) || 0),
      warehouseLocation: warehouseLocation.trim() || 'Main Central Warehouse',
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 10),
      batchNumber: batchNumber.trim() || undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      hasVariants,
      variants: hasVariants
        ? variants.map((v) => ({
          ...v,
          sku: v.sku.trim().toUpperCase(),
          dealerPricePaise: v.dealerPricePaise !== undefined ? v.dealerPricePaise : inrToPaise(dealerPrice),
          mrpPaise: v.mrpPaise !== undefined ? v.mrpPaise : inrToPaise(dealerPrice),
        }))
        : [],
      isTierPricingEnabled,
      tierPricing: isTierPricingEnabled
        ? tierPricing.map((t) => ({
          minQuantity: Number(t.minQuantity),
          maxQuantity: t.maxQuantity ? Number(t.maxQuantity) : undefined,
          unitPricePaise: inrToPaise(parseFloat(t.unitPriceRupees) || 0),
        }))
        : [],
      isActive: isSavingDraft ? false : isActive,
      isDraft: isSavingDraft,
      visibilityInMobile: isSavingDraft ? false : visibilityInMobile,
    };

    saveMutation.mutate(payload);
  };

  // Header action dispatcher - consistent with multi-step flow
  const handleHeaderAction = () => {
    if (isEditMode) {
      handleFinalSubmit({ asDraft: isDraft });
      return;
    }

    switch (activeTab) {
      case 'basic':
        handleNextFromStep1();
        break;
      case 'pricing':
        handleNextFromStep2();
        break;
      case 'inventory':
        handleNextFromStep3();
        break;
      case 'availability':
        handleFinalSubmit({ asDraft: false });
        break;
    }
  };

  const getHeaderButtonLabel = () => {
    if (saveMutation.isPending) return 'Saving...';
    if (isEditMode) return 'Update Product';
    switch (activeTab) {
      case 'basic':
        return 'Next: Pricing & Tax';
      case 'pricing':
        return 'Next: Inventory & Stock';
      case 'inventory':
        return 'Next: Availability & Visibility';
      case 'availability':
        return 'Create Product';
    }
  };

  // Calculations for Wholesale Pricing & GST Breakdown
  const wholesaleBasePrice = Math.max(0, parseFloat(dealerPriceRupees) || 0);
  const currentGstRate = Number(gstRatePercent) || 0;
  const applicableGstRs = (wholesaleBasePrice * currentGstRate) / 100;
  const wholesalePriceInclGst = wholesaleBasePrice + applicableGstRs;

  if (isEditMode && isLoadingProduct) {
    return (
      <div className="p-12 text-center text-[#737373]">
        <div className="w-6 h-6 border-2 border-[#F47732] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span>Loading product details...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0E0D5]">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            className="p-2 rounded-lg border border-[#F0E0D5] bg-white text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732] transition-colors shrink-0"
            title="Back to products list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#292929] flex items-center gap-2">
              <Package className="h-5 w-5 text-[#F47732] shrink-0" />
              <span>{isEditMode ? `Edit Product: ${name || sku}` : 'Add New Products'}</span>
            </h1>
            <p className="text-xs text-[#737373] mt-0.5">
              Specify product specifications, price, tax configuration, and inventory threshold.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Link
            to="/admin/products"
            className="px-3.5 py-2 text-xs font-semibold text-[#292929] bg-white border border-[#F0E0D5] rounded-lg hover:bg-[#FFF8F3] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleHeaderAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditMode || activeTab === 'availability' ? (
              <Save className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>{getHeaderButtonLabel()}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Wizard Step Progress Bar */}
      <div className="!my-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCurrent = activeTab === s.key;
            const isCompleted = completedSteps.has(s.key) && !isCurrent;
            const isClickable = completedSteps.has(s.key) || isCurrent || isEditMode;

            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleStepTabClick(s.key)}
                disabled={!isClickable}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all relative ${isCurrent
                  ? 'bg-[#FFF8F3] border-2 border-[#F47732] text-[#292929] shadow-xs'
                  : isCompleted
                    ? 'bg-white border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] cursor-pointer'
                    : 'bg-white border border-slate-200 text-[#737373] cursor-not-allowed opacity-60'
                  }`}
                title={isClickable ? `Go to Step ${s.stepNumber}: ${s.shortTitle}` : 'Complete previous steps to unlock'}
              >
                {/* Step Circle Badge */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${isCurrent
                    ? 'bg-[#F47732] text-white shadow-xs ring-2 ring-[#F47732]/25'
                    : isCompleted
                      ? 'bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5]'
                      : 'bg-slate-100 text-[#737373]'
                    }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 text-[#E95B2A]" /> : s.stepNumber}
                </div>

                {/* Step Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent
                        ? 'text-[#F47732]'
                        : isCompleted
                          ? 'text-[#E95B2A]'
                          : 'text-[#737373]'
                        }`}
                    >
                      Step {s.stepNumber}
                    </span>
                    {isCompleted && (
                      <span className="hidden lg:inline text-[9px] font-bold text-[#E95B2A] bg-[#FFF1E8] px-1.5 py-0.5 rounded border border-[#F0E0D5]">
                        Done
                      </span>
                    )}
                    {isCurrent && (
                      <span className="hidden lg:inline text-[9px] font-bold text-white bg-[#F47732] px-1.5 py-0.5 rounded shadow-xs">
                        Active
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs font-bold truncate mt-0.5 ${isCurrent
                      ? 'text-[#292929] font-black'
                      : isCompleted
                        ? 'text-[#292929]'
                        : 'text-[#737373]'
                      }`}
                  >
                    {s.shortTitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FORM SECTIONS */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleHeaderAction();
        }}
        className="space-y-6"
      >
        {/* SECTION 1: BASIC INFORMATION */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-xs space-y-4 !my-3">
              <h3 className="text-sm font-bold text-[#292929] pb-2 border-b border-[#F0E0D5] flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#F47732]" />
                Product Identification & Categorization
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Product Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                    placeholder="e.g. Premium White Bath Towel 100% Cotton 500 GSM"
                    className={`w-full text-xs p-2.5 border rounded-lg focus:ring-2 font-medium bg-white text-[#292929] ${fieldErrors.name
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                      : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.name && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Unique SKU / Product Code *
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value.toUpperCase());
                      clearFieldError('sku');
                    }}
                    placeholder="e.g. TOWEL-BATH-WHT-500"
                    className={`w-full font-mono text-xs p-2.5 border rounded-lg focus:ring-2 font-bold uppercase bg-white text-[#292929] ${fieldErrors.sku
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                      : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.sku ? (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.sku}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#737373] mt-1">Must be unique across all catalogue products.</p>
                  )}
                </div>

                {/* Barcode */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Barcode / EAN (Optional)
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 8901234567890"
                    className="w-full font-mono text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[#292929] uppercase">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsNewCategoryOpen(true)}
                      className="text-[10px] text-[#F47732] font-bold hover:underline"
                    >
                      + New Category
                    </button>
                  </div>
                  <CustomSelect
                    value={categoryId}
                    onChange={(val) => {
                      setCategoryId(val);
                      clearFieldError('categoryId');
                    }}
                    placeholder="Select Category"
                    options={[
                      { value: '', label: 'Select Category' },
                      ...categories.map((c: any) => ({
                        value: c._id || c.id,
                        label: c.name,
                      })),
                    ]}
                  />
                  {fieldErrors.categoryId && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.categoryId}</span>
                    </p>
                  )}
                </div>

                {/* Brand */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[#292929] uppercase">
                      Brand *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsNewBrandOpen(true)}
                      className="text-[10px] text-[#F47732] font-bold hover:underline"
                    >
                      + New Brand
                    </button>
                  </div>
                  <CustomSelect
                    value={brand}
                    onChange={(val) => {
                      setBrand(val);
                      clearFieldError('brand');
                    }}
                    options={brandOptions}
                  />
                  {fieldErrors.brand && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.brand}</span>
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Detailed Product Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Specify weave, material blend, commercial durability, recommended wash protocols, hospitality or hospital grade specs..."
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>

                {/* Multiple Images Upload & Gallery */}
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-[#292929] uppercase">
                      Product Images & Gallery (Multiple Images Supported)
                    </label>
                    <span className="text-[10px] text-[#737373]">
                      PNG, JPG, WebP, GIF • Max 5MB per file
                    </span>
                  </div>

                  {/* Drag-and-drop / File Selector Box */}
                  <div className="border-2 border-dashed border-[#F0E0D5] hover:border-[#F47732] bg-[#FFF8F3]/50 rounded-xl p-4 text-center transition-colors">
                    <input
                      type="file"
                      id="product-image-file-input"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploadingImages}
                    />
                    <label
                      htmlFor="product-image-file-input"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                    >
                      <div className="p-2.5 bg-[#FFF1E8] rounded-full text-[#F47732]">
                        {isUploadingImages ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-xs font-bold text-[#292929]">
                        {isUploadingImages ? 'Processing and uploading images...' : 'Click to Upload Images or Drag & Drop'}
                      </div>
                      <p className="text-[10px] text-[#737373]">
                        Select one or more product photos. First image or chosen cover will display as primary.
                      </p>
                    </label>
                  </div>

                  {imageUploadError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{imageUploadError}</span>
                    </div>
                  )}

                  {/* Image Previews Grid with Reordering & Primary Selection */}
                  {images.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-[#292929] mb-2 flex items-center justify-between">
                        <span>Current Gallery ({images.length} images)</span>
                        <span className="text-[10px] text-[#737373]">
                          Reorder using arrows • Select Cover Image
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {images.map((img, idx) => (
                          <div
                            key={idx}
                            className={`group relative rounded-xl border overflow-hidden p-1.5 bg-white transition-all shadow-xs ${img.isPrimary
                              ? 'border-[#F47732] ring-2 ring-[#F47732]/30 shadow-sm'
                              : 'border-[#F0E0D5] hover:border-[#F47732]/50'
                              }`}
                          >
                            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                              <img
                                src={getMediaUrl(img.url)}
                                alt={img.altText || `Product Image ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                              {img.isPrimary && (
                                <span className="absolute top-1 left-1 bg-[#F47732] text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs">
                                  Cover
                                </span>
                              )}
                              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                                #{idx + 1}
                              </span>
                            </div>

                            {/* Card Footer Controls */}
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(idx)}
                                  className={`text-[10px] font-bold transition-colors ${img.isPrimary
                                    ? 'text-[#F47732]'
                                    : 'text-[#737373] hover:text-[#292929]'
                                    }`}
                                >
                                  {img.isPrimary ? '★ Primary' : 'Set Cover'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 rounded transition-colors"
                                  title="Remove image"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Reorder Buttons */}
                              <div className="flex items-center justify-between pt-1 border-t border-[#F0E0D5]/50">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveImage(idx, 'left')}
                                  className={`p-1 rounded text-xs flex items-center gap-0.5 ${idx === 0
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3]'
                                    }`}
                                  title="Move earlier in order"
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                  <span className="text-[9px]">Move</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === images.length - 1}
                                  onClick={() => handleMoveImage(idx, 'right')}
                                  className={`p-1 rounded text-xs flex items-center gap-0.5 ${idx === images.length - 1
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3]'
                                    }`}
                                  title="Move later in order"
                                >
                                  <span className="text-[9px]">Move</span>
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Videos Upload & Gallery */}
                <div className="sm:col-span-2 space-y-3 pt-4 border-t border-[#F0E0D5]">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#292929] uppercase flex items-center gap-1.5">
                      <Film className="h-4 w-4 text-[#F47732]" />
                      <span>Product Videos & Demonstrations</span>
                      {videos.length > 0 && (
                        <span className="bg-[#FFF1E8] text-[#F47732] px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {videos.length} {videos.length === 1 ? 'Video' : 'Videos'} Added
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-[#737373]">
                      MP4, WebM, MOV, MKV • Max 50MB per video or YouTube/Vimeo/Direct URL
                    </span>
                  </div>

                  <div className="">
                    {/* Video File Upload Box */}
                    <div className="border-2 border-dashed border-[#F0E0D5] hover:border-[#F47732] bg-[#FFF8F3]/50 rounded-xl p-4 text-center transition-colors">
                      <input
                        type="file"
                        id="product-video-file-input"
                        multiple
                        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg"
                        onChange={handleVideoFileUpload}
                        className="hidden"
                        disabled={isUploadingVideo}
                      />
                      <label
                        htmlFor="product-video-file-input"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                      >
                        <div className="p-2.5 bg-[#FFF1E8] rounded-full text-[#F47732]">
                          {isUploadingVideo ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Video className="h-5 w-5" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-[#292929]">
                          {isUploadingVideo ? 'Uploading and processing video...' : 'Upload Video File (MP4 / WebM / MOV)'}
                        </div>
                        <p className="text-[10px] text-[#737373]">
                          Click to browse or drag & drop video files up to 50MB each
                        </p>
                      </label>
                    </div>
                  </div>

                  {videoUploadError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{videoUploadError}</span>
                    </div>
                  )}

                  {/* Video Previews Gallery */}
                  {videos.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-[#292929] mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Film className="h-3.5 w-3.5 text-[#F47732]" />
                          <span>Configured Product Videos ({videos.length})</span>
                        </span>
                        <span className="text-[10px] text-[#737373]">
                          Reorder videos or click play to preview
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {videos.map((vid, idx) => {
                          const embed = getEmbedVideoUrl(vid.url);
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-[#F0E0D5] overflow-hidden p-2 bg-white transition-all shadow-xs hover:border-[#F47732]/50 flex flex-col justify-between"
                            >
                              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                                {embed.isEmbed ? (
                                  <iframe
                                    src={embed.embedUrl}
                                    title={vid.title || `Video ${idx + 1}`}
                                    className="w-full h-full border-0 pointer-events-auto"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                ) : (
                                  <video
                                    src={vid.url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-contain"
                                  />
                                )}
                                <span className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 pointer-events-none">
                                  <PlayCircle className="h-3 w-3 text-[#F47732]" />
                                  <span>Video #{idx + 1}</span>
                                </span>
                              </div>

                              <div className="mt-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#292929] truncate" title={vid.title || 'Product Video'}>
                                      {vid.title || `Product Video ${idx + 1}`}
                                    </p>
                                    <p className="text-[10px] text-[#737373] truncate font-mono" title={vid.url}>
                                      {vid.url}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVideo(idx)}
                                    className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                                    title="Remove video"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* Reorder Controls & Full Preview */}
                                <div className="flex items-center justify-between pt-1.5 border-t border-[#F0E0D5]/50">
                                  <button
                                    type="button"
                                    onClick={() => setActivePreviewVideo(vid)}
                                    className="text-[10px] text-[#F47732] hover:text-[#E95B2A] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Play className="h-2.5 w-2.5 fill-current" />
                                    <span>Preview Full</span>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveVideo(idx, 'left')}
                                      className={`p-1 rounded text-xs flex items-center gap-0.5 ${idx === 0
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] cursor-pointer'
                                        }`}
                                      title="Move earlier"
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                      <span className="text-[9px]">Move</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === videos.length - 1}
                                      onClick={() => handleMoveVideo(idx, 'right')}
                                      className={`p-1 rounded text-xs flex items-center gap-0.5 ${idx === videos.length - 1
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] cursor-pointer'
                                        }`}
                                      title="Move later"
                                    >
                                      <span className="text-[9px]">Move</span>
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 1 Actions Footer */}
            <div className="p-4 bg-white rounded-xl border border-[#F0E0D5] shadow-xs flex items-center justify-between !my-3">
              <Link
                to="/admin/products"
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] text-xs font-semibold rounded-lg hover:bg-[#FFF8F3] transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Next: Pricing & Tax</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: PRICING AND TAX */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-xs space-y-4 !my-3">
              <h3 className="text-sm font-bold text-[#292929] pb-2 border-b border-[#F0E0D5] flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#F47732]" />
                Pricing & Margins
              </h3>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Base Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Base Price (Tax Exclusive ₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={dealerPriceRupees}
                    onChange={(e) => {
                      setDealerPriceRupees(e.target.value);
                      clearFieldError('dealerPriceRupees');
                    }}
                    className={`w-full text-xs p-2.5 border rounded-lg focus:ring-2 font-bold bg-white ${fieldErrors.dealerPriceRupees
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500 text-rose-700'
                      : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732] text-[#E95B2A]'
                      }`}
                  />
                  {fieldErrors.dealerPriceRupees && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.dealerPriceRupees}</span>
                    </p>
                  )}
                </div>

                {/* GST Rate (%) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    GST Rate (%) *
                  </label>
                  <CustomSelect
                    value={gstRatePercent}
                    onChange={(val) => {
                      setGstRatePercent(Number(val));
                      clearFieldError('gstRatePercent');
                    }}
                    options={[
                      { value: 0, label: '0% (Exempted Wholesale Goods)' },
                      { value: 5, label: '5% (Essential Wholesale Goods)' },
                      { value: 12, label: '12% (Apparel / Textiles / Specified)' },
                      { value: 18, label: '18% (Standard Wholesale Rate)' },
                      { value: 28, label: '28% (Luxury / Specified Goods)' },
                    ]}
                  />
                  {fieldErrors.gstRatePercent ? (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.gstRatePercent}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#737373] mt-1">
                      Tax added on wholesale base price during checkout
                    </p>
                  )}
                </div>

                {/* UOM */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Unit of Measurement (UOM) *
                  </label>
                  <CustomSelect
                    value={uom}
                    onChange={(val) => {
                      setUom(val);
                      clearFieldError('uom');
                    }}
                    options={[
                      { value: 'PCS', label: 'PCS (Pieces)' },
                      { value: 'BOX', label: 'BOX (Boxes)' },
                      { value: 'PACK', label: 'PACK (Packs)' },
                      { value: 'KG', label: 'KG (Kilograms)' },
                      { value: 'LTR', label: 'LTR (Liters)' },
                      { value: 'ROLL', label: 'ROLL (Rolls)' },
                      { value: 'DOZ', label: 'DOZ (Dozens)' },
                    ]}
                  />
                  {fieldErrors.uom && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.uom}</span>
                    </p>
                  )}
                </div>

                {/* Pack Size */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Pack Size (Units/Pack)
                  </label>
                  <input
                    type="number"
                    value={packSize}
                    onChange={(e) => {
                      setPackSize(e.target.value);
                      clearFieldError('packSize');
                    }}
                    className={`w-full text-xs p-2.5 border rounded-lg bg-white text-[#292929] ${fieldErrors.packSize ? 'border-rose-400 bg-rose-50/20' : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.packSize && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.packSize}</span>
                    </p>
                  )}
                </div>

                {/* Minimum Order Quantity (MOQ) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Minimum Order Quantity (MOQ)
                  </label>
                  <input
                    type="number"
                    value={minOrderQuantity}
                    onChange={(e) => {
                      setMinOrderQuantity(e.target.value);
                      clearFieldError('minOrderQuantity');
                    }}
                    className={`w-full text-xs p-2.5 border rounded-lg bg-white text-[#292929] ${fieldErrors.minOrderQuantity ? 'border-rose-400 bg-rose-50/20' : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.minOrderQuantity && (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.minOrderQuantity}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Quantity Discounts (Collapsible & Optional) */}
            <div className="bg-white rounded-xl border border-[#F0E0D5] shadow-xs overflow-hidden !my-3">
              {/* Collapsible Header */}
              <div
                className="p-5 flex items-center justify-between cursor-pointer select-none bg-white hover:bg-[#FFF8F3]/50 transition-colors border-b border-[#F0E0D5]/70"
                onClick={() => setIsBulkDiscountsExpanded((prev) => !prev)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors ${isTierPricingEnabled
                      ? 'bg-[#FFF1E8] text-[#F47732]'
                      : 'bg-slate-100 text-slate-500'
                      }`}
                  >
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#292929]">
                        Bulk Quantity Discounts
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isTierPricingEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                      >
                        {isTierPricingEnabled ? 'Enabled' : 'Optional / Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Offer better per-unit prices when customers order larger quantities.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {/* Switch toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTierPricingEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsTierPricingEnabled(checked);
                        if (checked) {
                          setIsBulkDiscountsExpanded(true);
                          if (tierPricing.length === 0) {
                            handleApplySampleTiers();
                          }
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F47732]"></div>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsBulkDiscountsExpanded((prev) => !prev)}
                    className="p-1 text-[#737373] hover:text-[#292929] transition-transform"
                    aria-label={isBulkDiscountsExpanded ? 'Collapse section' : 'Expand section'}
                  >
                    <ChevronDown
                      className={`h-5 w-5 transition-transform duration-200 ${isBulkDiscountsExpanded ? 'rotate-180 text-[#F47732]' : ''
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Collapsible Content */}
              {isBulkDiscountsExpanded && (
                <div className="p-6 space-y-4 bg-white">
                  {isTierPricingEnabled ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs text-[#737373]">
                          Configure continuous tiers starting at MOQ ({minOrderQuantity || 1} {uom}). Orders outside or below the first tier are charged at the base wholesale price (₹{dealerPriceRupees}).
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleApplySampleTiers}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-[#E95B2A] bg-[#FFF1E8] hover:bg-[#FFF8F3] border border-[#F0E0D5] font-semibold rounded-lg transition-colors"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Apply Sample Tiers</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleAddTier}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-[#F47732] hover:bg-[#E95B2A] font-bold rounded-lg shadow-xs transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Tier</span>
                          </button>
                        </div>
                      </div>

                      {/* Tiers Configuration Table */}
                      <div className="border border-[#F0E0D5] rounded-xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-center border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#FFF8F3] text-[#292929] border-b border-[#F0E0D5] font-bold text-[10px] uppercase">
                              <th className="py-2.5 px-3 text-center">Tier #</th>
                              <th className="py-2.5 px-3 text-center">Min Quantity</th>
                              <th className="py-2.5 px-3 text-center">Max Quantity</th>
                              <th className="py-2.5 px-3 text-center">Unit Price (₹)</th>
                              <th className="py-2.5 px-3 text-center">Discount vs Base</th>
                              <th className="py-2.5 px-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F0E0D5]/60">
                            {tierPricing.map((tier, idx) => {
                              const unitP = parseFloat(tier.unitPriceRupees) || 0;
                              const baseP = wholesaleBasePrice || 1;
                              const discountPct = baseP > 0 ? Math.round(((baseP - unitP) / baseP) * 100) : 0;
                              const isOpenEnded = tier.maxQuantity === undefined || tier.maxQuantity === null;
                              const isFinalTier = idx === tierPricing.length - 1;

                              return (
                                <tr key={idx} className="hover:bg-[#FFF8F3]/40">
                                  <td className="py-2.5 px-3 font-bold text-[#292929] text-center">
                                    Tier {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={tier.minQuantity}
                                      onChange={(e) =>
                                        handleUpdateTier(idx, 'minQuantity', Math.max(1, parseInt(e.target.value, 10) || 1))
                                      }
                                      className="w-24 text-xs p-1.5 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] font-semibold mx-auto block text-center"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <input
                                        type="number"
                                        min={tier.minQuantity}
                                        disabled={isOpenEnded}
                                        value={tier.maxQuantity ?? ''}
                                        onChange={(e) =>
                                          handleUpdateTier(
                                            idx,
                                            'maxQuantity',
                                            e.target.value ? parseInt(e.target.value, 10) : undefined
                                          )
                                        }
                                        placeholder="No max"
                                        className={`w-24 text-xs p-1.5 border rounded-lg font-semibold text-center ${isOpenEnded
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                          : 'bg-white text-[#292929] border-[#F0E0D5]'
                                          }`}
                                      />
                                      {isFinalTier ? (
                                        <label className="flex items-center gap-1 text-[11px] text-[#737373] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isOpenEnded}
                                            onChange={(e) =>
                                              handleUpdateTier(idx, 'maxQuantity', e.target.checked ? undefined : (tier.minQuantity + 9))
                                            }
                                            className="rounded border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732]"
                                          />
                                          <span>Open-ended ({tier.minQuantity}+)</span>
                                        </label>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">Fixed Range</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="relative w-28 mx-auto">
                                      <span className="absolute left-2 top-2 text-[#737373] text-xs">₹</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={tier.unitPriceRupees}
                                        onChange={(e) => handleUpdateTier(idx, 'unitPriceRupees', e.target.value)}
                                        className="w-full text-xs pl-6 p-1.5 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] font-bold text-center"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {discountPct > 0 ? (
                                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        Save {discountPct}%
                                      </span>
                                    ) : discountPct < 0 ? (
                                      <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        +{Math.abs(discountPct)}% Premium
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[#737373]">Base Price</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTier(idx)}
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors"
                                      title="Delete tier"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Tier Validation Error Banner */}
                      {(() => {
                        const parsedMoq = Math.max(1, parseInt(minOrderQuantity, 10) || 1);
                        const formatted = tierPricing.map((t) => ({
                          minQuantity: Number(t.minQuantity),
                          maxQuantity: t.maxQuantity ? Number(t.maxQuantity) : undefined,
                          unitPricePaise: inrToPaise(parseFloat(t.unitPriceRupees) || 0),
                        }));
                        const baseDealerPaise = inrToPaise(wholesaleBasePrice);
                        const result = validateTierPricing(formatted, baseDealerPaise, parsedMoq);
                        const err = !result.valid ? result.error : fieldErrors.tierPricing;
                        if (err) {
                          return (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                              <span>{err}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Real-Time Live Customer Pricing Preview */}
                      <div className="p-4 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#F47732] uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Live Customer Pricing Preview
                          </span>
                          <span className="text-[10px] text-[#737373]">
                            Updates instantly as tier inputs change
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {tierPricing.map((t, i) => {
                            const rangeStr = t.maxQuantity
                              ? `Qty ${t.minQuantity} – ${t.maxQuantity} ${uom}`
                              : `Qty ${t.minQuantity}+ ${uom}`;
                            const priceRs = parseFloat(t.unitPriceRupees) || 0;
                            const exampleQty = t.maxQuantity ? Math.floor((t.minQuantity + t.maxQuantity) / 2) : t.minQuantity;
                            const discountPct = wholesaleBasePrice > 0 ? Math.round(((wholesaleBasePrice - priceRs) / wholesaleBasePrice) * 100) : 0;
                            return (
                              <div
                                key={i}
                                className="bg-white p-3 rounded-lg border border-[#F0E0D5] text-center shadow-xs"
                              >
                                <span className="text-[10px] text-[#737373] uppercase font-bold block">
                                  {rangeStr}
                                </span>
                                <span className="text-sm font-black text-[#E95B2A] block my-0.5">
                                  ₹{priceRs.toFixed(2)} / {uom}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 block">
                                  {discountPct > 0 ? `${discountPct}% off base wholesale` : 'Standard base rate'}
                                </span>
                                <span className="text-[10px] text-slate-500 block mt-1">
                                  e.g. {exampleQty} {uom}s = ₹{(priceRs * exampleQty).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-[#737373]">
                      Bulk quantity discounts are currently disabled. All orders will be priced at the standard wholesale base price of{' '}
                      <span className="font-bold text-[#292929]">₹{wholesaleBasePrice.toFixed(2)}</span> per {uom}. Toggle the switch above to enable volume tiers.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 Actions Footer */}
            <div className="p-4 bg-white rounded-xl border border-[#F0E0D5] shadow-xs flex items-center justify-between !my-3">
              <button
                type="button"
                onClick={() => handleStepTabClick('basic')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#F0E0D5] text-[#292929] text-xs font-semibold rounded-lg hover:bg-[#FFF8F3] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back: Basic Information</span>
              </button>
              <button
                type="button"
                onClick={handleNextFromStep2}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Next: Inventory & Stock</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 3: INVENTORY & STOCK */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-xs space-y-4 !my-3">
              <h3 className="text-sm font-bold text-[#292929] pb-2 border-b border-[#F0E0D5] flex items-center gap-2">
                <Boxes className="h-4 w-4 text-[#F47732]" />
                Warehouse Storage & Inventory Thresholds
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Stock On Hand */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    {isEditMode ? 'Current Stock on Hand' : 'Opening Stock on Hand'} *
                  </label>
                  <input
                    type="number"
                    value={stockOnHand}
                    onChange={(e) => {
                      setStockOnHand(e.target.value);
                      clearFieldError('stockOnHand');
                    }}
                    className={`w-full text-xs p-2.5 border rounded-lg focus:ring-2 font-bold bg-white text-[#292929] ${fieldErrors.stockOnHand
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                      : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.stockOnHand ? (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.stockOnHand}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#737373] mt-1">
                      Stock adjustments are automatically recorded in the audit trail.
                    </p>
                  )}
                </div>

                {/* Warehouse Location */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Warehouse Location / Bay
                  </label>
                  <input
                    type="text"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    placeholder="Main Central Warehouse (Rack A-12)"
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>

                {/* Low Stock Threshold */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => {
                      setLowStockThreshold(e.target.value);
                      clearFieldError('lowStockThreshold');
                    }}
                    className={`w-full text-xs p-2.5 border rounded-lg focus:ring-2 font-semibold bg-white text-[#292929] ${fieldErrors.lowStockThreshold
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-500'
                      : 'border-[#F0E0D5] focus:ring-[#F47732] focus:border-[#F47732]'
                      }`}
                  />
                  {fieldErrors.lowStockThreshold ? (
                    <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{fieldErrors.lowStockThreshold}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#737373] mt-1">
                      Triggers amber warning on dashboard when available units fall below this count.
                    </p>
                  )}
                </div>

                {/* Batch Number */}
                <div>
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Batch / Lot Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g. LOT-2026-OCT-09"
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] font-mono bg-white text-[#292929]"
                  />
                </div>

                {/* Expiry Date */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#292929] uppercase mb-1">
                    Expiry Date (Only for Consumables)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full sm:w-1/2 text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>
              </div>
            </div>

            {/* Product Variants Management Section */}
            <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-xs space-y-4 !my-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#FFF1E8] rounded-lg text-[#F47732]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#292929]">
                      Product Variants (Sizes, Packs, Options)
                    </h3>
                    <p className="text-[11px] text-[#737373]">
                      Allow customers to choose from multiple sizes (500ml, 1L, 5L) or pack configurations with individual inventory tracking.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#737373]">
                    {hasVariants ? 'Enabled' : 'Disabled'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => {
                        setHasVariants(e.target.checked);
                        if (e.target.checked && variants.length === 0) {
                          handleOpenAddVariant();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F47732]"></div>
                  </label>
                </div>
              </div>

              {hasVariants ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#737373]">
                      Manage variant SKUs, individual stock levels, and optional price overrides. Each variant has dedicated inventory tracking.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddVariant}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-[#F47732] hover:bg-[#E95B2A] font-bold rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {variants.length > 0 ? (
                    <div className="border border-[#F0E0D5] rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-center border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FFF8F3] text-[#292929] border-b border-[#F0E0D5] font-bold text-[10px] uppercase">
                            <th className="py-2.5 px-3 text-center">Variant Attributes</th>
                            <th className="py-2.5 px-3 text-center">SKU</th>
                            <th className="py-2.5 px-3 text-center">Stock</th>
                            <th className="py-2.5 px-3 text-center">Dealer Price (₹)</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0E0D5]/60">
                          {variants.map((v, idx) => {
                            const attrList = v.attributes ? Object.entries(v.attributes) : [];
                            const dealerRs = v.dealerPricePaise !== undefined ? (v.dealerPricePaise / 100).toFixed(2) : parseFloat(dealerPriceRupees).toFixed(2);

                            return (
                              <tr key={idx} className={`hover:bg-[#FFF8F3]/40 ${!v.isActive ? 'opacity-60 bg-slate-50' : ''}`}>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="font-bold text-[#292929]">
                                    {v.name || 'Custom Variant'}
                                  </div>
                                  <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                                    {attrList.map(([k, val], aIdx) => (
                                      <span
                                        key={aIdx}
                                        className="text-[10px] bg-[#FFF1E8] text-[#E95B2A] px-1.5 py-0.5 rounded font-medium border border-[#F0E0D5]"
                                      >
                                        {k}: {String(val)}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-[#292929] text-center">
                                  {v.sku}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-[#292929]">
                                  {v.stockOnHand ?? 0}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-[#E95B2A]">
                                  ₹{dealerRs}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVariantActive(idx)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${v.isActive
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-200 text-slate-700'
                                      }`}
                                  >
                                    {v.isActive ? 'Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditVariant(idx)}
                                      className="p-1 text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] rounded transition-colors"
                                      title="Edit variant"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVariant(idx)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                      title="Delete or archive variant"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 bg-[#FFF8F3]/60 border border-dashed border-[#F0E0D5] rounded-xl text-center space-y-2">
                      <p className="text-xs font-semibold text-[#292929]">
                        No product variants configured yet.
                      </p>
                      <p className="text-[11px] text-[#737373]">
                        Click "Add Variant" above to define pack sizes, bottle volumes, or colour options with unique SKUs.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-[#737373]">
                  Variant options are disabled. This product will be sold as a single standalone SKU (<span className="font-mono font-semibold text-[#292929]">{sku || 'pending'}</span>).
                </div>
              )}
            </div>

            {/* Step 3 Actions Footer */}
            <div className="p-4 bg-white rounded-xl border border-[#F0E0D5] shadow-xs flex items-center justify-between !my-3">
              <button
                type="button"
                onClick={() => handleStepTabClick('pricing')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#F0E0D5] text-[#292929] text-xs font-semibold rounded-lg hover:bg-[#FFF8F3] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back: Pricing & Tax</span>
              </button>
              <button
                type="button"
                onClick={handleNextFromStep3}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <span>Next: Availability & Visibility</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 4: AVAILABILITY & VISIBILITY */}
        {activeTab === 'availability' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-xs space-y-4 !my-3">
              <h3 className="text-sm font-bold text-[#292929] pb-2 border-b border-[#F0E0D5] flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#F47732]" />
                Product Operational Status & Mobile App Visibility
              </h3>

              {/* Review Summary Card */}
              <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl p-4">
                <h4 className="text-xs font-bold text-[#292929] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#F47732]" />
                  Product Configuration Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-[#F0E0D5]">
                    <span className="text-[10px] text-[#737373] block uppercase font-bold">Product</span>
                    <span className="font-bold text-[#292929] truncate block" title={name}>
                      {name || '—'}
                    </span>
                    <span className="font-mono text-[10px] text-[#F47732] font-semibold">{sku || '—'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#F0E0D5]">
                    <span className="text-[10px] text-[#737373] block uppercase font-bold">Category & Brand</span>
                    <span className="font-bold text-[#292929] truncate block">
                      {categories.find((c: any) => (c._id || c.id) === categoryId)?.name || '—'}
                    </span>
                    <span className="text-[10px] text-[#737373]">{brand || '—'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#F0E0D5]">
                    <span className="text-[10px] text-[#737373] block uppercase font-bold">Wholesale Pricing</span>
                    <span className="font-bold text-[#E95B2A]">₹{wholesaleBasePrice.toFixed(2)}</span>
                    <span className="text-[10px] text-[#737373] block">
                      +{currentGstRate}% GST (₹{wholesalePriceInclGst.toFixed(2)} incl. tax)
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#F0E0D5]">
                    <span className="text-[10px] text-[#737373] block uppercase font-bold">Initial Inventory</span>
                    <span className="font-bold text-[#292929]">
                      {stockOnHand} {uom}
                    </span>
                    <span className="text-[10px] text-[#737373] truncate block">{warehouseLocation}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#F0E0D5]">
                    <span className="text-[10px] text-[#737373] block uppercase font-bold">Media Showcase</span>
                    <span className="font-bold text-[#292929] flex items-center gap-1">
                      <span>{images.length} Image{images.length === 1 ? '' : 's'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[#F47732]">{videos.length} Video{videos.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="text-[10px] text-[#737373] truncate block">
                      {videos.length > 0 ? 'Video showcase ready' : 'Images only'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Active / Inactive Switch */}
                <div className="p-4 rounded-xl border border-[#F0E0D5] bg-white flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#292929] block text-sm">Product Status (Active / Inactive)</span>
                    <span className="text-[#737373]">
                      When active, product is eligible for purchase and commercial quotation.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isActive ? 'bg-[#059669]' : 'bg-[#DC2626]'
                      }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Mobile App Visibility */}
                <div className="p-4 rounded-xl border border-[#F0E0D5] bg-white flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#292929] block text-sm">
                      Visible in Customer Mobile App
                    </span>
                    <span className="text-[#737373]">
                      Controls whether verified wholesale retailers see this product in their mobile ordering catalogue.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisibilityInMobile((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${visibilityInMobile ? 'bg-[#F47732]' : 'bg-[#F0E0D5]'
                      }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${visibilityInMobile ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Step 4 Actions Footer */}
            <div className="p-4 bg-white rounded-xl border border-[#F0E0D5] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 !my-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepTabClick('inventory')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#F0E0D5] text-[#292929] text-xs font-semibold rounded-lg hover:bg-[#FFF8F3] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back: Inventory & Stock</span>
                </button>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-4 py-2.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Delete Product</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => handleFinalSubmit({ asDraft: true })}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#F0E0D5] bg-[#FFF8F3] hover:bg-[#FFF1E8] text-[#E95B2A] text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  title="Save product as hidden draft"
                >
                  <FileText className="h-4 w-4 text-[#E95B2A]" />
                  <span>Save as Draft</span>
                </button>

                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => handleFinalSubmit({ asDraft: false })}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saveMutation.isPending ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* QUICK INLINE MODAL: NEW CATEGORY */}
      {isNewCategoryOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#F0E0D5] space-y-3">
            <h4 className="font-bold text-[#292929] text-sm">Add New Product Category</h4>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Bed Linen & Pillow Covers"
              className="w-full text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewCategoryOpen(false)}
                className="px-3 py-1.5 text-xs text-[#737373] hover:bg-[#FFF8F3] rounded-lg border border-[#F0E0D5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newCategoryName.trim()}
                onClick={async () => {
                  try {
                    const res = await apiClient.post('/products/categories', {
                      name: newCategoryName.trim(),
                    });
                    queryClient.invalidateQueries({ queryKey: ['categories'] });
                    setCategoryId(res.data.data._id || res.data.data.id);
                    setNewCategoryName('');
                    setIsNewCategoryOpen(false);
                  } catch (err: any) {
                    alert(err.response?.data?.error?.message || 'Failed to create category');
                  }
                }}
                className="px-3.5 py-1.5 text-xs bg-[#F47732] text-white font-bold rounded-lg hover:bg-[#E95B2A] transition-colors disabled:opacity-50"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK INLINE MODAL: NEW BRAND */}
      {isNewBrandOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#F0E0D5] space-y-3">
            <h4 className="font-bold text-[#292929] text-sm">Add New Brand</h4>
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="e.g. Raymond Hospitality, Portico"
              className="w-full text-xs p-2 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewBrandOpen(false)}
                className="px-3 py-1.5 text-xs text-[#737373] hover:bg-[#FFF8F3] rounded-lg border border-[#F0E0D5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newBrandName.trim()}
                onClick={async () => {
                  try {
                    await apiClient.post('/products/brands', {
                      name: newBrandName.trim(),
                    });
                    queryClient.invalidateQueries({ queryKey: ['brands'] });
                    setBrand(newBrandName.trim());
                    setNewBrandName('');
                    setIsNewBrandOpen(false);
                  } catch (err: any) {
                    alert(err.response?.data?.error?.message || 'Failed to create brand');
                  }
                }}
                className="px-3.5 py-1.5 text-xs bg-[#F47732] text-white font-bold rounded-lg hover:bg-[#E95B2A] transition-colors disabled:opacity-50"
              >
                Create Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT VARIANT CREATION & EDIT MODAL */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#F0E0D5] space-y-4 max-h-[90vh] overflow-y-auto touch-scroll">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FFF1E8] rounded-lg text-[#F47732]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#292929] text-sm">
                    {editingVariantIndex !== null ? 'Edit Product Variant' : 'Add Product Variant'}
                  </h3>
                  <p className="text-[11px] text-[#737373]">
                    Configure variant attributes, dedicated SKU, stock, and pricing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Variant Name & SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                    Variant Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={varName}
                    onChange={(e) => setVarName(e.target.value)}
                    placeholder="e.g. 500 ml Bottle or 6-Piece Pack (Auto-generated from attributes if blank)"
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                    Variant SKU *
                  </label>
                  <input
                    type="text"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value.toUpperCase())}
                    placeholder="e.g. TOWEL-BATH-WHT-500-6PK"
                    className="w-full font-mono font-bold text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] uppercase bg-white text-[#292929]"
                  />
                  <p className="text-[10px] text-[#737373] mt-0.5">Must be globally unique.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                    Barcode / EAN (Optional)
                  </label>
                  <input
                    type="text"
                    value={varBarcode}
                    onChange={(e) => setVarBarcode(e.target.value)}
                    placeholder="e.g. 8901234567891"
                    className="w-full font-mono text-xs p-2.5 border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white text-[#292929]"
                  />
                </div>
              </div>

              {/* Attributes Section */}
              <div className="bg-[#FFF8F3] p-3.5 rounded-xl border border-[#F0E0D5] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#F47732] uppercase">
                    Configurable Attributes * (e.g. Size, Pack, Volume)
                  </label>
                  <button
                    type="button"
                    onClick={() => setVarAttributes((prev) => [...prev, { key: '', value: '' }])}
                    className="text-[10px] font-bold text-[#E95B2A] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Attribute</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {varAttributes.map((attr, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVarAttributes((prev) => {
                            const copy = [...prev];
                            copy[aIdx] = { ...copy[aIdx], key: val };
                            return copy;
                          });
                        }}
                        placeholder="Attribute (e.g. Size, Pack)"
                        className="w-1/3 text-xs p-2 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] focus:ring-2 focus:ring-[#F47732]"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVarAttributes((prev) => {
                            const copy = [...prev];
                            copy[aIdx] = { ...copy[aIdx], value: val };
                            return copy;
                          });
                        }}
                        placeholder="Value (e.g. 500 ml, 6 Pcs)"
                        className="flex-1 text-xs p-2 border border-[#F0E0D5] rounded-lg bg-white text-[#292929] focus:ring-2 focus:ring-[#F47732]"
                      />
                      {varAttributes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setVarAttributes((prev) => prev.filter((_, i) => i !== aIdx))}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Remove attribute"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock and Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                    Stock On Hand *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={varStock}
                    onChange={(e) => setVarStock(e.target.value)}
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg font-bold bg-white text-[#292929] focus:ring-2 focus:ring-[#F47732]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#292929] uppercase mb-1">
                    Dealer Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={varDealerPrice}
                    onChange={(e) => setVarDealerPrice(e.target.value)}
                    placeholder={dealerPriceRupees || 'Base Price'}
                    className="w-full text-xs p-2.5 border border-[#F0E0D5] rounded-lg font-bold text-[#E95B2A] bg-white focus:ring-2 focus:ring-[#F47732]"
                  />
                  <p className="text-[9px] text-[#737373] mt-0.5">Leave blank to use ₹{dealerPriceRupees || '0'}</p>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="p-3 bg-[#FFF8F3]/60 rounded-xl border border-[#F0E0D5] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#292929] block text-xs">Variant Active Status</span>
                  <span className="text-[10px] text-[#737373]">
                    Inactive variants are hidden from customer app selection.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setVarIsActive((prev) => !prev)}
                  className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${varIsActive ? 'bg-[#059669]' : 'bg-slate-300'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${varIsActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0E0D5]">
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariant}
                className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
              >
                {editingVariantIndex !== null ? 'Save Changes' : 'Add Variant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#F0E0D5] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 rounded-xl text-rose-600 flex-shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#292929] text-base">Delete Product</h3>
                <p className="text-xs text-[#737373] mt-0.5">
                  Are you sure you want to delete <span className="font-bold text-[#292929]">{name}</span> ({sku})?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>ERP Safeguard:</strong> If this product is linked to existing customer orders, it will be safely deactivated and unlisted from the catalogue to preserve order audit records. If no orders exist, it will be permanently deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-950/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL VIDEO PREVIEW MODAL */}
      {activePreviewVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 !m-0">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-[#F0E0D5] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E0D5]">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-[#F47732]" />
                <h4 className="font-bold text-[#292929] text-sm">
                  {activePreviewVideo.title || 'Product Video Preview'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewVideo(null)}
                className="p-1 text-[#737373] hover:text-[#292929] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
              {(() => {
                const embed = getEmbedVideoUrl(activePreviewVideo.url);
                if (embed.isEmbed) {
                  return (
                    <iframe
                      src={embed.embedUrl}
                      title={activePreviewVideo.title || 'Video'}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <video
                    src={activePreviewVideo.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                );
              })()}
            </div>
            <div className="flex justify-between items-center text-xs text-[#737373] pt-1">
              <span className="truncate max-w-[75%] font-mono text-[11px]">{activePreviewVideo.url}</span>
              <button
                type="button"
                onClick={() => setActivePreviewVideo(null)}
                className="px-3 py-1.5 bg-[#FFF1E8] text-[#F47732] font-bold rounded-lg hover:bg-[#F0E0D5] transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
