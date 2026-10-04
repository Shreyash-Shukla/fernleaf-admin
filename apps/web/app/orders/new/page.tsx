'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { formatCents, formatDate, formatMinutesToTime, minutesToTimeString, timeStringToMinutes } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Package,
  User,
  Building,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface SelectedCombination {
  quantity: number;
  options: {
    groupName: string;
    optionName: string;
    portionName?: string | null;
  }[];
}

interface OrderLineDraft {
  dishId: string;
  dishName: string;
  dishSku: string;
  dishPriceCents: number;
  minOrderQty?: number;
  quantity: number;
  combinations: SelectedCombination[];
}

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Current Step: 1 = Employee & Date, 2 = Menu & Selection, 3 = Combinations, 4 = Delivery Details, 5 = Review & Submit
  const [step, setStep] = useState(1);

  // Form State
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeMin, setDeliveryTimeMin] = useState(720); // 12:00 PM
  const [addressId, setAddressId] = useState('');
  const [packaging, setPackaging] = useState('STANDARD');
  const [orderNotes, setOrderNotes] = useState('');
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);

  // Selected Order Lines
  const [orderLines, setOrderLines] = useState<OrderLineDraft[]>([]);

  // 1. Fetch Companies
  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ['companies', 'for-order'],
    queryFn: () => fetchApi('/companies?limit=100&active=true'),
  });

  // 2. Fetch Selected Company Detail (addresses, calendar, defaults)
  const { data: companyDetail } = useQuery<any>({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetchApi(`/companies/${selectedCompanyId}`),
    enabled: !!selectedCompanyId,
  });

  // 3. Fetch Employees for selected company
  const { data: employeesData } = useQuery<{ employees: any[] }>({
    queryKey: ['employees', 'company', selectedCompanyId],
    queryFn: () => fetchApi(`/employees?companyId=${selectedCompanyId}&limit=100&active=true`),
    enabled: !!selectedCompanyId,
  });

  // 4. Fetch Selected Employee Detail
  const { data: employeeDetail } = useQuery<any>({
    queryKey: ['employee', selectedEmployeeId],
    queryFn: () => fetchApi(`/employees/${selectedEmployeeId}`),
    enabled: !!selectedEmployeeId,
  });

  // 5. Fetch Resolved Menu for Selected Employee
  const { data: menuData, isLoading: menuLoading } = useQuery<any>({
    queryKey: ['menu', 'preview', selectedEmployeeId],
    queryFn: () => fetchApi(`/menu/preview?employeeId=${selectedEmployeeId}`),
    enabled: !!selectedEmployeeId && step >= 2,
  });

  // 6. Meta for today
  const { data: meta } = useQuery<any>({
    queryKey: ['meta'],
    queryFn: () => fetchApi('/meta'),
  });

  // Set default date when meta arrives
  useEffect(() => {
    if (meta?.today && !deliveryDate) {
      const d = new Date(meta.today);
      d.setDate(d.getDate() + 1); // default to tomorrow
      setDeliveryDate(d.toISOString().slice(0, 10));
    }
  }, [meta, deliveryDate]);

  // Set defaults when company changes
  useEffect(() => {
    if (companyDetail) {
      if (companyDetail.defaultDeliveryTimeMin !== undefined) {
        setDeliveryTimeMin(companyDetail.defaultDeliveryTimeMin);
      }
      if (companyDetail.defaultPackaging) {
        setPackaging(companyDetail.defaultPackaging);
      }
      const defaultAddr = companyDetail.addresses?.find((a: any) => a.isDefault) || companyDetail.addresses?.[0];
      if (defaultAddr) {
        setAddressId(defaultAddr.id);
      }
    }
  }, [companyDetail]);

  // 7. Preview Mutation
  const previewMutation = useMutation({
    mutationFn: (payload: any) => fetchApi('/orders/preview', { method: 'POST', body: JSON.stringify(payload) }),
  });

  // Run preview when entering Step 5
  useEffect(() => {
    if (step === 5 && selectedEmployeeId && deliveryDate && addressId) {
      const payload = {
        employeeId: selectedEmployeeId,
        deliveryDate,
        deliveryTimeMin,
        addressId,
        packaging,
        lines: orderLines.map((line) => ({
          dishId: line.dishId,
          quantity: line.quantity,
          combinations: line.combinations,
        })),
        notes: orderNotes,
        allergenAcknowledged,
      };
      previewMutation.mutate(payload);
    }
  }, [step, selectedEmployeeId, deliveryDate, deliveryTimeMin, addressId, packaging, orderLines, allergenAcknowledged, orderNotes]);

  // Place Order Mutation
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateOrder(shouldPlace: boolean) {
    if (!selectedEmployeeId || !deliveryDate || !addressId) {
      toast.error('Please complete required employee and delivery details.');
      return;
    }
    if (orderLines.length === 0) {
      toast.error('Please add at least one dish to the order.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: selectedEmployeeId,
        deliveryDate,
        deliveryTimeMin,
        addressId,
        packaging,
        notes: orderNotes,
        lines: orderLines.map((line) => ({
          dishId: line.dishId,
          quantity: line.quantity,
          combinations: line.combinations,
        })),
        allergenAcknowledged,
      };

      // 1. Create draft
      const draftRes = await fetchApi<{ order: any }>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const orderId = draftRes.order.id;

      if (shouldPlace) {
        // 2. Transition to PLACED
        await fetchApi(`/orders/${orderId}/place`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Order #${draftRes.order.number} placed successfully!`);
      } else {
        toast.success(`Draft order #${draftRes.order.number} saved!`);
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.push(`/orders/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  }

  // Dish adding helper
  function addDishToOrder(dish: any) {
    const existingIndex = orderLines.findIndex((l) => l.dishId === dish.id);
    const minQty = dish.minOrderQty || 1;

    if (existingIndex >= 0) {
      toast.info(`${dish.name} is already added. Adjust quantity in Step 3.`);
      return;
    }

    // Generate initial combination satisfying required groups
    const initialComboOptions: any[] = [];
    if (dish.optionGroups) {
      dish.optionGroups.forEach((group: any) => {
        if (group.required && group.options?.length > 0) {
          const firstOpt = group.options[0];
          initialComboOptions.push({
            groupName: group.name,
            optionName: firstOpt.name,
            portionName: group.usesPortions && group.portions?.length > 0 ? group.portions[0].portionSize.name : null,
          });
        }
      });
    }

    const newLine: OrderLineDraft = {
      dishId: dish.id,
      dishName: dish.name,
      dishSku: dish.sku,
      dishPriceCents: dish.priceCents,
      minOrderQty: dish.minOrderQty,
      quantity: minQty,
      combinations: [
        {
          quantity: minQty,
          options: initialComboOptions,
        },
      ],
    };

    setOrderLines([...orderLines, newLine]);
    toast.success(`Added ${dish.name} to order.`);
  }

  return (
    <AppShell requiredPermission="orders:write">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
              <span>Create Order</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Order Builder: configure dish combinations, enforce employee rules, and live validate
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/orders')}
            className="text-xs self-start"
          >
            Cancel & Return
          </Button>
        </div>

        {/* Stepper Header */}
        <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
          {[
            { num: 1, label: 'Employee & Date' },
            { num: 2, label: 'Select Menu' },
            { num: 3, label: 'Combinations' },
            { num: 4, label: 'Delivery' },
            { num: 5, label: 'Review & Place' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
              disabled={s.num > step}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                step === s.num
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                  : step > s.num
                  ? 'text-slate-300 hover:text-white cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  step === s.num
                    ? 'bg-emerald-500 text-slate-950'
                    : step > s.num
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: Employee & Delivery Date */}
        {step === 1 && (
          <Card className="border-slate-800 p-6 space-y-5">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Step 1: Choose Employee & Delivery Date</CardTitle>
              <CardDescription className="text-xs">
                Select the target company and employee to load their designated price tier and permissions.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Company *
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedEmployeeId('');
                    setOrderLines([]);
                  }}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a Company...</option>
                  {companiesData?.companies?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Employee *
                </label>
                <select
                  value={selectedEmployeeId}
                  disabled={!selectedCompanyId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setOrderLines([]);
                  }}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">
                    {selectedCompanyId ? 'Select Employee...' : 'Select Company first'}
                  </option>
                  {employeesData?.employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Delivery Date *
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be a kitchen & company working day and not a holiday.
                </p>
              </div>
            </div>

            {/* Employee Profile Preview */}
            {employeeDetail && (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-xs text-white">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>{employeeDetail.name}</span>
                    <span className="text-slate-400 font-normal">({employeeDetail.email})</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Tier: {companyDetail?.tier?.name || 'Default Tier'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  {employeeDetail.allergens?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-rose-300 bg-rose-950/40 border border-rose-900/50 px-2 py-0.5 rounded text-[11px]">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      Allergies: {employeeDetail.allergens.map((a: any) => a.allergen.name).join(', ')}
                    </div>
                  )}
                  {employeeDetail.dietaryTags?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded text-[11px]">
                      Preferences: {employeeDetail.dietaryTags.map((t: any) => t.tag.name).join(', ')}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 pt-1 flex gap-4">
                  <span>Address customisation: {employeeDetail.canChooseAddress ? 'Allowed' : 'Locked to default'}</span>
                  <span>Time change: {employeeDetail.canChangeTime ? 'Allowed' : 'Locked to company default'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button
                disabled={!selectedEmployeeId || !deliveryDate}
                onClick={() => setStep(2)}
                className="text-xs"
              >
                Continue to Menu <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Menu Selection */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Resolved Menu for {employeeDetail?.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Showing available items on price tier <strong className="text-emerald-400">{menuData?.tier?.name}</strong>. Dishes with unpriced options or items are automatically hidden.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300">
                  Selected items: <strong>{orderLines.length}</strong>
                </span>
                <Button
                  disabled={orderLines.length === 0}
                  onClick={() => setStep(3)}
                  size="sm"
                  className="text-xs"
                >
                  Configure Options ({orderLines.length}) <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>

            {menuLoading ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                Loading resolved menu items...
              </div>
            ) : menuData?.categories?.length > 0 ? (
              <div className="space-y-6">
                {menuData.categories.map((category: any) => (
                  <div key={category.id} className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-1 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                      <span>{category.name}</span>
                      <span className="text-slate-500 text-[10px] font-normal">
                        {category.dishes?.length || 0} items
                      </span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.dishes?.map((dish: any) => {
                        const isAdded = orderLines.some((l) => l.dishId === dish.id);
                        return (
                          <Card
                            key={dish.id}
                            className={`p-4 bg-slate-900/60 transition-all ${
                              isAdded ? 'border-emerald-500/60 shadow-emerald-950/20' : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <div className="font-semibold text-sm text-slate-100">{dish.name}</div>
                                <div className="text-[11px] font-mono text-slate-400">SKU: {dish.sku}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-emerald-400">
                                  {formatCents(dish.priceCents)}
                                </div>
                                {dish.temperature && (
                                  <Badge variant="outline" className="text-[9px] py-0">
                                    {dish.temperature}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {dish.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                                {dish.description}
                              </p>
                            )}

                            {/* Tags & Allergens */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {dish.dietaryTags?.map((tag: any) => (
                                <Badge key={tag.id} variant="secondary" className="text-[9px] py-0">
                                  {tag.name}
                                </Badge>
                              ))}
                              {dish.allergens?.map((all: any) => (
                                <span
                                  key={all.id}
                                  className="text-[9px] text-amber-300 bg-amber-950/40 border border-amber-900/40 px-1.5 py-0.5 rounded"
                                >
                                  {all.name}
                                </span>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">
                                {dish.minOrderQty ? `Min qty: ${dish.minOrderQty}` : 'Min qty: 1'}
                              </span>

                              <Button
                                size="sm"
                                variant={isAdded ? 'secondary' : 'default'}
                                onClick={() => addDishToOrder(dish)}
                                className="h-7 text-xs px-2.5"
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-emerald-400" /> Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                  </>
                                )}
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                No dishes available for this employee on this tier.
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button variant="outline" onClick={() => setStep(1)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </Button>
              <Button disabled={orderLines.length === 0} onClick={() => setStep(3)} className="text-xs">
                Configure Options ({orderLines.length} dishes) <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Configure Combinations */}
        {step === 3 && (
          <Card className="border-slate-800 p-6 space-y-6">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Step 3: Quantities & Option Combinations</CardTitle>
              <CardDescription className="text-xs">
                Each order line is cooked in units. Set overall line quantity, and specify combinations (e.g. 6 paneer, 4 tofu).
              </CardDescription>
            </CardHeader>

            <div className="space-y-6 pt-2">
              {orderLines.map((line, lineIdx) => {
                // Find dish schema in menuData to read available option groups
                let dishSchema: any = null;
                menuData?.categories?.forEach((cat: any) => {
                  const d = cat.dishes?.find((dish: any) => dish.id === line.dishId);
                  if (d) dishSchema = d;
                });

                const totalComboQty = line.combinations.reduce((sum, c) => sum + (c.quantity || 0), 0);
                const isQtyValid = totalComboQty === line.quantity;

                return (
                  <div
                    key={line.dishId}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <div className="font-semibold text-sm text-white">{line.dishName}</div>
                        <div className="text-xs text-emerald-400 font-medium">
                          Base price: {formatCents(line.dishPriceCents)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <label className="text-slate-400 font-medium">Line Qty:</label>
                          <input
                            type="number"
                            min={line.minOrderQty || 1}
                            value={line.quantity}
                            onChange={(e) => {
                              const val = Math.max(line.minOrderQty || 1, parseInt(e.target.value, 10) || 1);
                              const updated = [...orderLines];
                              updated[lineIdx].quantity = val;
                              // Sync first combination qty if single combo
                              if (updated[lineIdx].combinations.length === 1) {
                                updated[lineIdx].combinations[0].quantity = val;
                              }
                              setOrderLines(updated);
                            }}
                            className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-white"
                          />
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOrderLines(orderLines.filter((_, idx) => idx !== lineIdx));
                          }}
                          className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Combinations List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300">
                          Combinations (Sum: {totalComboQty} / {line.quantity})
                        </span>
                        {!isQtyValid && (
                          <span className="text-amber-400 text-[11px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Combination quantities must equal line quantity!
                          </span>
                        )}
                      </div>

                      {line.combinations.map((combo, comboIdx) => (
                        <div
                          key={comboIdx}
                          className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-300">
                              Combo #{comboIdx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="text-slate-400 text-[11px]">Units:</label>
                              <input
                                type="number"
                                min={1}
                                value={combo.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  const updated = [...orderLines];
                                  updated[lineIdx].combinations[comboIdx].quantity = val;
                                  setOrderLines(updated);
                                }}
                                className="w-14 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-center text-xs text-white"
                              />
                              {line.combinations.length > 1 && (
                                <button
                                  onClick={() => {
                                    const updated = [...orderLines];
                                    updated[lineIdx].combinations = updated[lineIdx].combinations.filter(
                                      (_, cIdx) => cIdx !== comboIdx
                                    );
                                    setOrderLines(updated);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Options Selection for Groups */}
                          {dishSchema?.optionGroups?.map((group: any) => {
                            const currentSel = combo.options.find((o) => o.groupName === group.name);
                            return (
                              <div key={group.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <div>
                                  <label className="text-[11px] text-slate-400 block mb-1">
                                    {group.name} {group.required ? '*' : '(Optional)'}
                                  </label>
                                  <select
                                    value={currentSel?.optionName || ''}
                                    onChange={(e) => {
                                      const optName = e.target.value;
                                      const updated = [...orderLines];
                                      const comboOpts = [...combo.options].filter((o) => o.groupName !== group.name);
                                      if (optName) {
                                        comboOpts.push({
                                          groupName: group.name,
                                          optionName: optName,
                                          portionName: currentSel?.portionName || null,
                                        });
                                      }
                                      updated[lineIdx].combinations[comboIdx].options = comboOpts;
                                      setOrderLines(updated);
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                                  >
                                    {!group.required && <option value="">None</option>}
                                    {group.options?.map((opt: any) => (
                                      <option key={opt.id} value={opt.name}>
                                        {opt.name} ({formatCents(opt.priceCents)})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {group.usesPortions && (
                                  <div>
                                    <label className="text-[11px] text-slate-400 block mb-1">
                                      Size / Portion
                                    </label>
                                    <select
                                      value={currentSel?.portionName || ''}
                                      onChange={(e) => {
                                        const pName = e.target.value;
                                        const updated = [...orderLines];
                                        const targetOpt = updated[lineIdx].combinations[comboIdx].options.find(
                                          (o) => o.groupName === group.name
                                        );
                                        if (targetOpt) {
                                          targetOpt.portionName = pName || null;
                                        }
                                        setOrderLines(updated);
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                                    >
                                      {group.portions?.map((port: any) => (
                                        <option key={port.id} value={port.portionSize?.name}>
                                          {port.portionSize?.name}{' '}
                                          {port.extraCents ? `(+${formatCents(port.extraCents)})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Add another combination button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = [...orderLines];
                          const remainingQty = Math.max(1, line.quantity - totalComboQty);
                          // clone first combo options
                          const firstComboOpts = line.combinations[0]?.options || [];
                          updated[lineIdx].combinations.push({
                            quantity: remainingQty,
                            options: JSON.parse(JSON.stringify(firstComboOpts)),
                          });
                          setOrderLines(updated);
                        }}
                        className="text-xs h-7"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Split Combination
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button variant="outline" onClick={() => setStep(2)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Menu
              </Button>
              <Button
                disabled={orderLines.some((l) => {
                  const sum = l.combinations.reduce((s, c) => s + c.quantity, 0);
                  return sum !== l.quantity;
                })}
                onClick={() => setStep(4)}
                className="text-xs"
              >
                Proceed to Delivery <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 4: Delivery Details */}
        {step === 4 && (
          <Card className="border-slate-800 p-6 space-y-5">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Step 4: Delivery Details & Employee Permissions</CardTitle>
              <CardDescription className="text-xs">
                Configure delivery address, planned delivery time, and packaging according to company and employee permissions.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Delivery Address *
                </label>
                <select
                  value={addressId}
                  disabled={!employeeDetail?.canChooseAddress && companyDetail?.addresses?.length > 1}
                  onChange={(e) => setAddressId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                >
                  {companyDetail?.addresses?.map((addr: any) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} — {addr.line1}, {addr.city} {addr.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                {!employeeDetail?.canChooseAddress && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Employee cannot choose custom address (fixed to company default address).
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Delivery Time (Kitchen Zone) *
                </label>
                <input
                  type="time"
                  step={300}
                  disabled={!employeeDetail?.canChangeTime}
                  value={minutesToTimeString(deliveryTimeMin)}
                  onChange={(e) => setDeliveryTimeMin(timeStringToMinutes(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                />
                {!employeeDetail?.canChangeTime && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Employee cannot change delivery time (fixed to company default:{' '}
                    {formatMinutesToTime(companyDetail?.defaultDeliveryTimeMin)}).
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Packaging Type *
                </label>
                <select
                  value={packaging}
                  disabled={!employeeDetail?.canChangePackaging}
                  onChange={(e) => setPackaging(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                >
                  <option value="STANDARD">Standard Packaging</option>
                  <option value="INSULATED">Insulated Thermal Packaging</option>
                  <option value="ECO">Eco-Friendly Biodegradable</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Special Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leave at 4th floor reception"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button variant="outline" onClick={() => setStep(3)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Combinations
              </Button>
              <Button onClick={() => setStep(5)} className="text-xs">
                Review & Live Validation <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 5: Review & Place */}
        {step === 5 && (
          <div className="space-y-6">
            <Card className="border-slate-800 p-6 space-y-5">
              <CardHeader className="p-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Step 5: Order Breakdown & Live Preview</CardTitle>
                  <CardDescription className="text-xs">
                    Live server validation results, allergen cross-checks, and exact financial snapshot.
                  </CardDescription>
                </div>

                <Badge variant={previewMutation.data?.valid ? 'default' : 'destructive'}>
                  {previewMutation.isPending
                    ? 'Validating on Server...'
                    : previewMutation.data?.valid
                    ? 'Server Validation Passed'
                    : 'Validation Issues'}
                </Badge>
              </CardHeader>

              {/* Server Errors if invalid */}
              {previewMutation.data && !previewMutation.data.valid && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4" /> Validation Errors:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {previewMutation.data.errors?.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Allergen Warning Banner */}
              {previewMutation.data?.warnings?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-800/70 text-xs text-amber-200 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Allergen Warnings Detected:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {previewMutation.data.warnings.map((warn: string, i: number) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 pt-1 font-semibold text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allergenAcknowledged}
                      onChange={(e) => setAllergenAcknowledged(e.target.checked)}
                      className="rounded border-amber-600 bg-amber-950 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>I acknowledge the allergen warnings and wish to proceed.</span>
                  </label>
                </div>
              )}

              {/* Order Summary & Pricing Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Order Lines Breakdown
                  </h4>

                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                    {previewMutation.data?.lines?.map((line: any, idx: number) => (
                      <div key={idx} className="p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{line.dishName}</span>
                          <span className="font-bold text-emerald-400">
                            {formatCents(line.lineTotalCents)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {line.quantity} units @ base {formatCents(line.dishPriceCents)}
                        </div>

                        {/* Combinations */}
                        <div className="pl-3 border-l-2 border-slate-800 space-y-1 mt-1 text-[11px] text-slate-400">
                          {line.combinations?.map((c: any, cIdx: number) => (
                            <div key={cIdx} className="flex justify-between">
                              <span>
                                {c.quantity}x {c.label || 'Standard'}
                              </span>
                              <span>{formatCents(c.totalCents)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Delivery & Total Box */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                    <h4 className="font-semibold text-slate-200">Delivery Details</h4>
                    <div className="space-y-1.5 text-slate-400 text-[11px]">
                      <div><strong>Company:</strong> {companyDetail?.name}</div>
                      <div><strong>Employee:</strong> {employeeDetail?.name}</div>
                      <div><strong>Date:</strong> {formatDate(deliveryDate)}</div>
                      <div><strong>Time:</strong> {formatMinutesToTime(deliveryTimeMin)}</div>
                      <div><strong>Packaging:</strong> {packaging}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-xs space-y-2">
                    <div className="flex justify-between text-slate-300 font-medium">
                      <span>Subtotal:</span>
                      <span>{formatCents(previewMutation.data?.totalCents || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-emerald-500/20">
                      <span>Total Billed:</span>
                      <span className="text-emerald-400 text-base">
                        {formatCents(previewMutation.data?.totalCents || 0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1">
                      Employees never pay directly. Billed to corporate account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <Button variant="outline" onClick={() => setStep(4)} className="text-xs">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Delivery
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleCreateOrder(false)}
                    loading={submitting}
                    className="text-xs"
                  >
                    Save as Draft
                  </Button>

                  <Button
                    onClick={() => handleCreateOrder(true)}
                    disabled={previewMutation.data && !previewMutation.data.valid}
                    loading={submitting}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Place Order Now
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
