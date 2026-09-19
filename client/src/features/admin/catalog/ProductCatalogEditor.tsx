import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  CircleDollarSign,
  Image as ImageIcon,
  Layers3,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ProductType = "simple" | "sizes" | "buildable" | "multi_flavor" | "combo";
type EditorialStatus = "draft" | "published";

type SizeDraft = { key: string; name: string; price: string; promotionalPrice: string; serves: string; minFlavors: string; maxFlavors: string };
type OptionDraft = { key: string; name: string; price: string; maxQuantity: string };
type GroupDraft = { key: string; name: string; required: boolean; minSelections: string; maxSelections: string; freeSelections: string; options: OptionDraft[] };
type FlavorDraft = { key: string; name: string; prices: string[] };

type EditorProduct = {
  id: number;
  categoryId: number;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  price: string;
  imageUrl?: string | null;
  sku?: string | null;
  productType?: ProductType;
  editorialStatus?: EditorialStatus;
  preparationTime?: number | null;
  minQuantity?: number;
  maxQuantity?: number;
  couponEligible?: boolean;
  pointsEligible?: boolean;
  featured?: boolean;
};

type ProductCatalogEditorProps = {
  storeId: number;
  categories: Array<{ id: number; name: string }>;
  product?: EditorProduct | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptySize = (name = ""): SizeDraft => ({ key: newKey(), name, price: "", promotionalPrice: "", serves: "", minFlavors: "1", maxFlavors: "2" });
const emptyOption = (): OptionDraft => ({ key: newKey(), name: "", price: "0.00", maxQuantity: "1" });
const emptyGroup = (): GroupDraft => ({ key: newKey(), name: "", required: false, minSelections: "0", maxSelections: "1", freeSelections: "0", options: [emptyOption()] });
const emptyFlavor = (sizeCount: number): FlavorDraft => ({ key: newKey(), name: "", prices: Array.from({ length: sizeCount }, () => "") });
const toOptionalInt = (value: string) => value.trim() ? Number.parseInt(value, 10) : null;
const toMoney = (value: string) => Number(value || 0).toFixed(2);

const productTypes: Array<{ id: ProductType; title: string; description: string; icon: typeof ChefHat }> = [
  { id: "simple", title: "Produto simples", description: "Um produto com um preço único.", icon: PackagePlus },
  { id: "sizes", title: "Com tamanhos", description: "Preços diferentes por tamanho ou porção.", icon: Layers3 },
  { id: "multi_flavor", title: "Pizza meio a meio", description: "Tamanhos, sabores e regra de cobrança.", icon: Sparkles },
  { id: "buildable", title: "Personalizável", description: "Adicionais, bordas, molhos e escolhas.", icon: CircleDollarSign },
  { id: "combo", title: "Combo", description: "Produto principal com grupos de escolha.", icon: ChefHat },
];

export function ProductCatalogEditor({ storeId, categories, product, onClose, onSaved }: ProductCatalogEditorProps) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0);
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? "simple");
  const [basic, setBasic] = useState({
    categoryId: product ? String(product.categoryId) : "",
    name: product?.name ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    price: product?.price ?? "",
    imageUrl: product?.imageUrl ?? "",
    sku: product?.sku ?? "",
    preparationTime: product?.preparationTime ? String(product.preparationTime) : "",
    minQuantity: String(product?.minQuantity ?? 1),
    maxQuantity: String(product?.maxQuantity ?? 99),
    featured: product?.featured ?? false,
    couponEligible: product?.couponEligible ?? true,
    pointsEligible: product?.pointsEligible ?? true,
  });
  const [sizes, setSizes] = useState<SizeDraft[]>([]);
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [flavors, setFlavors] = useState<FlavorDraft[]>([]);
  const [pricingRule, setPricingRule] = useState<"highest_price" | "average_price" | "proportional_price" | "size_fixed_price" | "base_plus_difference">("highest_price");
  const [allowRepeatedFlavors, setAllowRepeatedFlavors] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const hydratedProductId = useRef<number | null>(null);

  const configuration = trpc.catalog.adminConfiguration.useQuery(
    { storeId, productId: product?.id ?? 0 },
    { enabled: Boolean(product?.id), staleTime: 30_000 },
  );

  useEffect(() => {
    if (!product?.id || !configuration.data || hydratedProductId.current === product.id) return;
    hydratedProductId.current = product.id;
    const data = configuration.data;
    setSizes(data.sizes.map((size) => ({
      key: String(size.id), name: size.name, price: String(size.price),
      promotionalPrice: size.promotionalPrice == null ? "" : String(size.promotionalPrice),
      serves: "", minFlavors: String(size.minFlavors ?? 1), maxFlavors: String(size.maxFlavors ?? 2),
    })));
    setGroups(data.modifierGroups.map((group) => ({
      key: String(group.id), name: group.name, required: group.required,
      minSelections: String(group.minSelections), maxSelections: String(group.maxSelections), freeSelections: String(group.freeSelections),
      options: group.options.map((option) => ({ key: String(option.id), name: option.name, price: String(option.price), maxQuantity: String(option.maxQuantity) })),
    })));
    setPricingRule(data.flavorSettings?.pricingRule ?? "highest_price");
    setAllowRepeatedFlavors(data.flavorSettings?.allowRepeatedFlavors ?? false);
    setFlavors(data.flavors.map((flavor) => ({
      key: String(flavor.id), name: flavor.name,
      prices: data.sizes.map((size) => String(flavor.pricesBySize[size.id] ?? size.price)),
    })));
  }, [configuration.data, product?.id]);

  useEffect(() => {
    if ((productType === "sizes" || productType === "multi_flavor") && sizes.length === 0) {
      setSizes([emptySize("Pequena"), emptySize("Grande")]);
    }
    if ((productType === "buildable" || productType === "combo") && groups.length === 0) setGroups([emptyGroup()]);
  }, [productType, sizes.length, groups.length]);

  useEffect(() => {
    setFlavors((current) => current.map((flavor) => ({
      ...flavor,
      prices: Array.from({ length: sizes.length }, (_, index) => flavor.prices[index] ?? sizes[index]?.price ?? ""),
    })));
  }, [sizes]);

  const uploadImage = trpc.products.uploadImage.useMutation({
    onSuccess: (data) => { setBasic((current) => ({ ...current, imageUrl: data.url })); toast.success("Imagem enviada"); },
    onError: (error) => toast.error(error.message),
    onSettled: () => setImageUploading(false),
  });

  const saveProduct = trpc.catalog.saveProduct.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([utils.products.list.invalidate(), utils.products.listAll.invalidate()]);
      toast.success(variables.editorialStatus === "published" ? "Produto publicado" : "Rascunho salvo");
      await onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) return toast.error("Use JPG, PNG, WebP ou GIF");
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no maximo 5MB");
    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? "").split(",")[1];
      if (!base64) return setImageUploading(false);
      uploadImage.mutate({ storeId, base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const canAdvance = useMemo(() => {
    if (step === 0) return Boolean(productType);
    if (step === 1) return Boolean(basic.categoryId && basic.name.trim().length >= 2 && Number(basic.price) >= 0);
    if (step === 2 && ["sizes", "multi_flavor"].includes(productType)) {
      const validSizes = sizes.length > 0 && sizes.every((size) => size.name.trim() && Number(size.price) >= 0);
      const validFlavors = flavors.length >= 2 && flavors.every((flavor) =>
        flavor.name.trim() &&
        flavor.prices.length === sizes.length &&
        flavor.prices.every((price) => price.trim() !== "" && Number(price) >= 0),
      );
      return productType === "multi_flavor" ? validSizes && validFlavors : validSizes;
    }
    return true;
  }, [basic, flavors, productType, sizes, step]);

  const submit = (status: EditorialStatus) => {
    if (!basic.categoryId || !basic.name.trim() || !basic.price) return toast.error("Preencha categoria, nome e preço");
    if (productType === "multi_flavor" && (flavors.length < 2 || flavors.some((flavor) => !flavor.name.trim() || flavor.prices.some((price) => price.trim() === "")))) {
      return toast.error("Preencha pelo menos dois sabores e seus preços");
    }
    saveProduct.mutate({
      storeId, productId: product?.id, categoryId: Number(basic.categoryId), name: basic.name,
      shortDescription: basic.shortDescription || null, description: basic.description || null,
      price: toMoney(basic.price), imageUrl: basic.imageUrl || null, sku: basic.sku || null,
      productType, editorialStatus: status, preparationTime: toOptionalInt(basic.preparationTime),
      minQuantity: Number(basic.minQuantity || 1), maxQuantity: Number(basic.maxQuantity || 99),
      couponEligible: basic.couponEligible, pointsEligible: basic.pointsEligible, featured: basic.featured,
      sizes: ["sizes", "multi_flavor"].includes(productType) ? sizes.map((size) => ({
        name: size.name, price: toMoney(size.price), promotionalPrice: size.promotionalPrice ? toMoney(size.promotionalPrice) : null,
        serves: toOptionalInt(size.serves), minFlavors: toOptionalInt(size.minFlavors), maxFlavors: toOptionalInt(size.maxFlavors),
      })) : [],
      modifierGroups: groups.filter((group) => group.name.trim() && group.options.some((option) => option.name.trim())).map((group) => ({
        name: group.name, required: group.required, minSelections: Number(group.minSelections || 0), maxSelections: Number(group.maxSelections || 1),
        freeSelections: Number(group.freeSelections || 0), options: group.options.filter((option) => option.name.trim()).map((option) => ({
          name: option.name, price: toMoney(option.price), maxQuantity: Number(option.maxQuantity || 1),
        })),
      })),
      flavorSettings: productType === "multi_flavor" ? { enabled: true, pricingRule, allowRepeatedFlavors } : null,
      flavors: productType === "multi_flavor" ? flavors.filter((flavor) => flavor.name.trim()).map((flavor) => ({ name: flavor.name, prices: flavor.prices.map(toMoney) })) : [],
    });
  };

  const steps = ["Tipo", "Informações", "Montagem", "Revisão"];
  return (
    <section className="overflow-hidden rounded-3xl border border-[#e7d8d2] bg-[#fffdfb] shadow-[0_24px_70px_rgba(69,7,9,0.12)]">
      <header className="flex flex-col gap-5 border-b border-[#eadeda] bg-[#450709] px-5 py-5 text-white sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffadb0]">Editor de catálogo</p>
            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{product ? `Editar ${product.name}` : "Criar novo produto"}</h2>
            <p className="mt-1 text-sm text-white/65">Configure tudo em uma sequência segura e veja o resumo antes de publicar.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0 rounded-full text-white hover:bg-white/10 hover:text-white" aria-label="Fechar editor"><X className="h-5 w-5" /></Button>
        </div>
        <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do cadastro">
          {steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <button type="button" onClick={() => index <= step && setStep(index)} className="w-full text-left" aria-current={index === step ? "step" : undefined}>
                <span className={`mb-2 block h-1 rounded-full ${index <= step ? "bg-[#DA1923]" : "bg-white/15"}`} />
                <span className={`block truncate text-[10px] font-bold uppercase tracking-wider sm:text-xs ${index === step ? "text-white" : "text-white/45"}`}>{index + 1}. {label}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="p-5 sm:p-7">
        {step === 0 && (
          <div>
            <div className="mb-5"><h3 className="text-lg font-black text-[#2b1718]">Como este produto é vendido?</h3><p className="text-sm text-[#7d6669]">A escolha libera somente as configurações necessárias.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productTypes.map((type) => {
                const Icon = type.icon; const active = productType === type.id;
                return <button key={type.id} type="button" onClick={() => setProductType(type.id)} className={`group min-h-36 rounded-2xl border p-4 text-left transition-all ${active ? "border-[#DA1923] bg-[#fff1f0] shadow-[0_10px_28px_rgba(218,25,35,0.12)]" : "border-[#eadeda] bg-white hover:-translate-y-0.5 hover:border-[#c8aaa7]"}`}>
                  <span className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[#DA1923] text-white" : "bg-[#f5eeea] text-[#6e0d12]"}`}><Icon className="h-5 w-5" /></span>
                  <span className="block font-black text-[#2b1718]">{type.title}</span><span className="mt-1 block text-sm leading-relaxed text-[#7d6669]">{type.description}</span>
                </button>;
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do produto" required><Input value={basic.name} onChange={(event) => setBasic({ ...basic, name: event.target.value })} placeholder="Ex.: Pizza Bonatto Especial" /></Field>
              <Field label="Categoria" required><Select value={basic.categoryId} onValueChange={(value) => setBasic({ ...basic, categoryId: value })}><SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Preço base" required><Input type="number" min="0" step="0.01" value={basic.price} onChange={(event) => setBasic({ ...basic, price: event.target.value })} placeholder="0,00" /></Field>
              <Field label="Codigo interno / SKU"><Input value={basic.sku} onChange={(event) => setBasic({ ...basic, sku: event.target.value })} placeholder="PIZ-GR-001" /></Field>
              <Field label="Descrição curta" className="sm:col-span-2"><Input value={basic.shortDescription} onChange={(event) => setBasic({ ...basic, shortDescription: event.target.value })} placeholder="Uma frase para vender o produto" maxLength={320} /></Field>
              <Field label="Descrição completa" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#DA1923]/20" value={basic.description} onChange={(event) => setBasic({ ...basic, description: event.target.value })} placeholder="Ingredientes, diferenciais e informações importantes" /></Field>
              <Field label="Tempo de preparo (min)"><Input type="number" min="0" max="600" value={basic.preparationTime} onChange={(event) => setBasic({ ...basic, preparationTime: event.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Mínimo"><Input type="number" min="1" value={basic.minQuantity} onChange={(event) => setBasic({ ...basic, minQuantity: event.target.value })} /></Field><Field label="Máximo"><Input type="number" min="1" value={basic.maxQuantity} onChange={(event) => setBasic({ ...basic, maxQuantity: event.target.value })} /></Field></div>
            </div>
            <div>
              <Label className="mb-2 block">Foto do produto</Label>
              <button type="button" onClick={() => imageInputRef.current?.click()} className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#d8c5bf] bg-[#f8f2ee] transition hover:border-[#DA1923]">
                {basic.imageUrl ? <><img src={basic.imageUrl} alt="Previa do produto" className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-[#450709]/65 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100"><Upload className="mr-2 h-4 w-4" /> Trocar imagem</span></> : imageUploading ? <Loader2 className="h-8 w-8 animate-spin text-[#DA1923]" /> : <span className="px-6 text-center text-sm font-semibold text-[#7d6669]"><ImageIcon className="mx-auto mb-3 h-8 w-8 text-[#DA1923]" />Clique ou arraste a foto principal</span>}
              </button>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { handleImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              <Input className="mt-3" value={basic.imageUrl} onChange={(event) => setBasic({ ...basic, imageUrl: event.target.value })} placeholder="Ou cole uma URL HTTPS" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            {["sizes", "multi_flavor"].includes(productType) && <SizesEditor sizes={sizes} setSizes={setSizes} />}
            {productType === "multi_flavor" && <FlavorsEditor sizes={sizes} flavors={flavors} setFlavors={setFlavors} pricingRule={pricingRule} setPricingRule={setPricingRule} allowRepeated={allowRepeatedFlavors} setAllowRepeated={setAllowRepeatedFlavors} />}
            <ModifierGroupsEditor groups={groups} setGroups={setGroups} productType={productType} />
            {productType === "simple" && groups.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8c5bf] bg-[#faf6f3] p-8 text-center"><Check className="mx-auto mb-3 h-8 w-8 text-[#DA1923]" /><p className="font-black text-[#2b1718]">Nenhuma montagem obrigatoria</p><p className="mt-1 text-sm text-[#7d6669]">Voce pode publicar agora ou adicionar um grupo de opcionais.</p><Button type="button" variant="outline" className="mt-4" onClick={() => setGroups([emptyGroup()])}><Plus className="mr-2 h-4 w-4" />Adicionar opcionais</Button></div>}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div><h3 className="text-lg font-black text-[#2b1718]">Tudo pronto para publicar</h3><p className="text-sm text-[#7d6669]">Revise as regras. Você pode salvar como rascunho sem mostrar no cardápio.</p></div>
              <ReviewRow label="Tipo" value={productTypes.find((type) => type.id === productType)?.title ?? productType} />
              <ReviewRow label="Categoria" value={categories.find((category) => String(category.id) === basic.categoryId)?.name ?? "Nao selecionada"} />
              <ReviewRow label="Preço base" value={`R$ ${Number(basic.price || 0).toFixed(2).replace(".", ",")}`} />
              <ReviewRow label="Tamanhos" value={sizes.length ? sizes.map((size) => size.name).join(", ") : "Preço único"} />
              <ReviewRow label="Sabores" value={productType === "multi_flavor" ? `${flavors.length} cadastrados` : "Não se aplica"} />
              <ReviewRow label="Grupos de escolha" value={groups.length ? `${groups.length} grupo(s)` : "Nenhum"} />
              <div className="grid gap-3 sm:grid-cols-3"><ToggleCard label="Em destaque" checked={basic.featured} onChange={(checked) => setBasic({ ...basic, featured: checked })} /><ToggleCard label="Aceita cupom" checked={basic.couponEligible} onChange={(checked) => setBasic({ ...basic, couponEligible: checked })} /><ToggleCard label="Gera pontos" checked={basic.pointsEligible} onChange={(checked) => setBasic({ ...basic, pointsEligible: checked })} /></div>
            </div>
            <div className="rounded-3xl bg-[#f3ebe6] p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b6665]">Prévia no cardápio</p>
              <div className="overflow-hidden rounded-2xl bg-white shadow-[0_14px_35px_rgba(69,7,9,0.12)]">
                <div className="aspect-[4/3] bg-[#eadeda]">{basic.imageUrl ? <img src={basic.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ChefHat className="h-10 w-10 text-[#b99b97]" /></div>}</div>
                <div className="p-4"><p className="font-black text-[#2b1718]">{basic.name || "Nome do produto"}</p><p className="mt-1 line-clamp-2 text-sm text-[#7d6669]">{basic.shortDescription || basic.description || "Descrição do produto"}</p><div className="mt-4 flex items-end justify-between"><span className="text-xs font-bold uppercase tracking-wider text-[#8b6665]">A partir de</span><strong className="text-xl text-[#DA1923]">R$ {Number(basic.price || 0).toFixed(2).replace(".", ",")}</strong></div></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-col-reverse gap-3 border-t border-[#eadeda] bg-[#faf6f3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <Button type="button" variant="ghost" onClick={step === 0 ? onClose : () => setStep((current) => current - 1)}><ArrowLeft className="mr-2 h-4 w-4" />{step === 0 ? "Cancelar" : "Voltar"}</Button>
        {step < 3 ? <Button type="button" onClick={() => canAdvance ? setStep((current) => current + 1) : toast.error("Complete os campos desta etapa")} className="bg-[#DA1923] hover:bg-[#b9141d]">Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button> : <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" disabled={saveProduct.isPending} onClick={() => submit("draft")}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button><Button type="button" disabled={saveProduct.isPending} onClick={() => submit("published")} className="bg-[#DA1923] hover:bg-[#b9141d]">{saveProduct.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Publicar produto</Button></div>}
      </footer>
    </section>
  );
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}{required && <span className="text-[#DA1923]"> *</span>}</Label>{children}</div>; }
function ReviewRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-6 border-b border-[#eadeda] py-3"><span className="text-sm text-[#7d6669]">{label}</span><strong className="text-right text-sm text-[#2b1718]">{value}</strong></div>; }
function ToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadeda] bg-white p-3 text-sm font-bold text-[#2b1718]">{label}<Switch checked={checked} onCheckedChange={onChange} /></label>; }

function SizesEditor({ sizes, setSizes }: { sizes: SizeDraft[]; setSizes: React.Dispatch<React.SetStateAction<SizeDraft[]>> }) {
  return <section><div className="mb-4 flex items-end justify-between gap-4"><div><h3 className="font-black text-[#2b1718]">Tamanhos e preços</h3><p className="text-sm text-[#7d6669]">Cada tamanho pode ter preço, promoção e limite de sabores.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setSizes((current) => [...current, emptySize()])}><Plus className="mr-1 h-4 w-4" />Tamanho</Button></div><div className="space-y-3">{sizes.map((size, index) => <div key={size.key} className="grid gap-3 rounded-2xl border border-[#eadeda] bg-white p-4 sm:grid-cols-[1.2fr_1fr_1fr_0.7fr_auto]"><Field label="Nome"><Input value={size.name} onChange={(event) => setSizes((current) => current.map((entry) => entry.key === size.key ? { ...entry, name: event.target.value } : entry))} placeholder="Grande" /></Field><Field label="Preço"><Input type="number" min="0" step="0.01" value={size.price} onChange={(event) => setSizes((current) => current.map((entry) => entry.key === size.key ? { ...entry, price: event.target.value } : entry))} /></Field><Field label="Promocional"><Input type="number" min="0" step="0.01" value={size.promotionalPrice} onChange={(event) => setSizes((current) => current.map((entry) => entry.key === size.key ? { ...entry, promotionalPrice: event.target.value } : entry))} /></Field><Field label="Serve"><Input type="number" min="1" value={size.serves} onChange={(event) => setSizes((current) => current.map((entry) => entry.key === size.key ? { ...entry, serves: event.target.value } : entry))} /></Field><Button type="button" variant="ghost" size="icon" className="self-end text-[#a22]" onClick={() => setSizes((current) => current.filter((entry) => entry.key !== size.key))} aria-label={`Remover tamanho ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div></section>;
}

function FlavorsEditor({ sizes, flavors, setFlavors, pricingRule, setPricingRule, allowRepeated, setAllowRepeated }: { sizes: SizeDraft[]; flavors: FlavorDraft[]; setFlavors: React.Dispatch<React.SetStateAction<FlavorDraft[]>>; pricingRule: "highest_price" | "average_price" | "proportional_price" | "size_fixed_price" | "base_plus_difference"; setPricingRule: (value: "highest_price" | "average_price" | "proportional_price" | "size_fixed_price" | "base_plus_difference") => void; allowRepeated: boolean; setAllowRepeated: (value: boolean) => void }) {
  return (
    <section className="min-w-0 rounded-3xl bg-[#450709] p-4 text-white sm:p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 className="font-black">Sabores e regra de cobrança</h3><p className="text-sm text-white/60">Defina o valor de cada sabor em cada tamanho.</p></div>
        <Button type="button" size="sm" className="bg-[#DA1923] hover:bg-[#b9141d]" onClick={() => setFlavors((current) => [...current, emptyFlavor(sizes.length)])}><Plus className="mr-1 h-4 w-4" />Sabor</Button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={pricingRule} onValueChange={setPricingRule}><SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="highest_price">Cobrar o sabor mais caro</SelectItem><SelectItem value="average_price">Média dos sabores</SelectItem><SelectItem value="proportional_price">Preço proporcional</SelectItem><SelectItem value="size_fixed_price">Preço fixo do tamanho</SelectItem><SelectItem value="base_plus_difference">Base mais diferença</SelectItem></SelectContent></Select>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">Repetir sabor <Switch checked={allowRepeated} onCheckedChange={setAllowRepeated} /></label>
      </div>
      <div className="space-y-3">
        {flavors.map((flavor) => (
          <div key={flavor.key} className="min-w-0 rounded-2xl bg-white/10 p-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1"><Field label="Sabor"><Input className="border-white/15 bg-white text-[#2b1718]" value={flavor.name} onChange={(event) => setFlavors((current) => current.map((entry) => entry.key === flavor.key ? { ...entry, name: event.target.value } : entry))} placeholder="Calabresa" /></Field></div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={() => setFlavors((current) => current.filter((entry) => entry.key !== flavor.key))} aria-label={`Remover sabor ${flavor.name || "sem nome"}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sizes.map((size, sizeIndex) => <Field key={size.key} label={size.name || `Tamanho ${sizeIndex + 1}`}><Input className="border-white/15 bg-white text-[#2b1718]" type="number" min="0" step="0.01" value={flavor.prices[sizeIndex] ?? ""} onChange={(event) => setFlavors((current) => current.map((entry) => entry.key === flavor.key ? { ...entry, prices: entry.prices.map((price, index) => index === sizeIndex ? event.target.value : price) } : entry))} /></Field>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModifierGroupsEditor({ groups, setGroups, productType }: { groups: GroupDraft[]; setGroups: React.Dispatch<React.SetStateAction<GroupDraft[]>>; productType: ProductType }) {
  const title = productType === "combo" ? "Grupos do combo" : "Adicionais e escolhas";
  return <section><div className="mb-4 flex items-end justify-between gap-4"><div><h3 className="font-black text-[#2b1718]">{title}</h3><p className="text-sm text-[#7d6669]">Ex.: escolha a borda, adicionais ou bebidas do combo.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setGroups((current) => [...current, emptyGroup()])}><Plus className="mr-1 h-4 w-4" />Grupo</Button></div><div className="space-y-4">{groups.map((group) => <div key={group.key} className="min-w-0 rounded-2xl border border-[#eadeda] bg-white p-4"><div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto_100px_100px_auto]"><Field label="Nome do grupo"><Input value={group.name} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, name: event.target.value } : entry))} placeholder="Escolha a borda" /></Field><label className="flex items-end gap-2 pb-2 text-sm font-semibold"><Switch checked={group.required} onCheckedChange={(checked) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, required: checked, minSelections: checked && entry.minSelections === "0" ? "1" : entry.minSelections } : entry))} />Obrigatorio</label><Field label="Minimo"><Input type="number" min="0" value={group.minSelections} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, minSelections: event.target.value } : entry))} /></Field><Field label="Maximo"><Input type="number" min="1" value={group.maxSelections} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, maxSelections: event.target.value } : entry))} /></Field><Button type="button" variant="ghost" size="icon" className="self-end text-[#a22]" onClick={() => setGroups((current) => current.filter((entry) => entry.key !== group.key))}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-4 space-y-2 border-l-2 border-[#f0d7d3] pl-3 sm:pl-4">{group.options.map((option) => <div key={option.key} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_80px_auto]"><Input value={option.name} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, options: entry.options.map((item) => item.key === option.key ? { ...item, name: event.target.value } : item) } : entry))} placeholder="Nome da opcao" /><Input type="number" min="0" step="0.01" value={option.price} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, options: entry.options.map((item) => item.key === option.key ? { ...item, price: event.target.value } : item) } : entry))} placeholder="Preco" /><Input type="number" min="1" value={option.maxQuantity} onChange={(event) => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, options: entry.options.map((item) => item.key === option.key ? { ...item, maxQuantity: event.target.value } : item) } : entry))} /><Button type="button" variant="ghost" size="icon" onClick={() => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, options: entry.options.filter((item) => item.key !== option.key) } : entry))}><X className="h-4 w-4" /></Button></div>)}<Button type="button" variant="ghost" size="sm" onClick={() => setGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, options: [...entry.options, emptyOption()] } : entry))}><Plus className="mr-1 h-4 w-4" />Opcao</Button></div></div>)}</div></section>;
}
