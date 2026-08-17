import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  X,
  Download,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import MaskedInput from '../../components/MaskedInput';
import FileUpload from '../../components/FileUpload';
import BuildingTag from '../../components/BuildingTag';
import PhoneActions from '../../components/PhoneActions';
import AllotmentLetter from '../../components/AllotmentLetter';
import { feeReminderMessage, whatsappLink } from '../../lib/whatsapp';
import { supabase } from '../../lib/supabase';
import { useBuilding, type BuildingRow } from '../../lib/BuildingContext';
import {
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadAadhaarImage,
  type StudentRow,
  type StudentRowWithBuilding,
  type StudentStatus,
} from '../../data/students';
import {
  createFeeStructure,
  getFeeStructure,
  type FeeStructureRow,
} from '../../data/fees';
import {
  fetchAvailableBedsForBuilding,
  assignBedToStudent,
  unassignBed,
  type BedRowEnriched,
} from '../../data/beds';

interface FormState {
  name: string;
  mobile: string;
  course: string;
  college_id: string;
  parent_mobile: string;
  branch: string;
  aadhaar_number: string;
  aadhaar_image_url: string;
  notes: string;
  status: StudentStatus;
  building_id: number | null;
  bed_id: number | null;
}

const EMPTY_FORM: FormState = {
  name: '',
  mobile: '',
  course: '',
  college_id: '',
  parent_mobile: '',
  branch: '',
  aadhaar_number: '',
  aadhaar_image_url: '',
  notes: '',
  status: 'active',
  building_id: null,
  bed_id: null,
};

export default function StudentsEnhanced() {
  const { current, isAllBuildings, buildings, loading: buildingLoading } = useBuilding();
  const [students, setStudents] = useState<StudentRowWithBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [viewStudent, setViewStudent] = useState<StudentRowWithBuilding | null>(null);
  const [viewFee, setViewFee] = useState<FeeStructureRow | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [feeFilter, setFeeFilter] = useState<'all' | 'Fully Paid' | 'Partially Paid' | 'Pending'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showBulkReminder, setShowBulkReminder] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [availableBeds, setAvailableBeds] = useState<BedRowEnriched[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);

  // When the building chosen in the form changes, load that building's free beds.
  // Include the editing student's own bed if any, so it shows as the current selection.
  useEffect(() => {
    if (!showForm || !formData.building_id) {
      setAvailableBeds([]);
      return;
    }
    let cancelled = false;
    setLoadingBeds(true);
    fetchAvailableBedsForBuilding(formData.building_id)
      .then((rows) => {
        if (!cancelled) setAvailableBeds(rows);
      })
      .catch(() => {
        if (!cancelled) setAvailableBeds([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBeds(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm, formData.building_id]);

  useEffect(() => {
    if (buildingLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const buildingId = isAllBuildings ? null : current?.id ?? null;

    fetchStudents(buildingId)
      .then((rows) => {
        if (!cancelled) setStudents(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingLoading, isAllBuildings, current?.id]);

  const reload = async () => {
    const buildingId = isAllBuildings ? null : current?.id ?? null;
    const rows = await fetchStudents(buildingId);
    setStudents(rows);
  };

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      building_id: isAllBuildings
        ? buildings[0]?.id ?? null
        : current?.id ?? null,
    });
    setAadhaarFile(null);
  };

  const openCreate = () => {
    setEditingStudent(null);
    resetForm();
    setShowForm(true);
  };

  const openEdit = (s: StudentRowWithBuilding) => {
    setEditingStudent(s);
    setFormData({
      name: s.name,
      mobile: s.mobile,
      course: s.course ?? '',
      college_id: s.college_id ?? '',
      parent_mobile: s.parent_mobile ?? '',
      branch: s.branch ?? '',
      aadhaar_number: s.aadhaar_number ?? '',
      aadhaar_image_url: s.aadhaar_image_url ?? '',
      notes: s.notes ?? '',
      status: s.status,
      building_id: s.building_id,
      bed_id: s.bed_id,
    });
    setAadhaarFile(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingStudent(null);
    setAadhaarFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.aadhaar_number.length !== 12) {
      toast.error('Aadhaar number must be 12 digits');
      return;
    }
    if (formData.mobile.length !== 10 || formData.parent_mobile.length !== 10) {
      toast.error('Mobile numbers must be 10 digits');
      return;
    }
    if (!formData.building_id) {
      toast.error('Please pick a building for this student');
      return;
    }

    const dupCollege = students.find(
      (s) =>
        s.college_id &&
        s.college_id === formData.college_id &&
        s.id !== editingStudent?.id,
    );
    if (dupCollege) {
      toast.error('College ID already exists');
      return;
    }
    const dupMobile = students.find(
      (s) => s.mobile === formData.mobile && s.id !== editingStudent?.id,
    );
    if (dupMobile) {
      toast.error('Mobile number already exists');
      return;
    }

    setSubmitting(true);
    try {
      let aadhaarImageUrl = formData.aadhaar_image_url;
      if (aadhaarFile) {
        aadhaarImageUrl = await uploadAadhaarImage(aadhaarFile);
      }

      const payload = {
        name: formData.name,
        mobile: formData.mobile,
        course: formData.course || null,
        college_id: formData.college_id || null,
        parent_mobile: formData.parent_mobile || null,
        branch: formData.branch || null,
        aadhaar_number: formData.aadhaar_number || null,
        aadhaar_image_url: aadhaarImageUrl || null,
        notes: formData.notes || null,
        status: formData.status,
        building_id: formData.building_id,
        bed_id: null, // bed assignment handled separately below
      };

      let studentId: number;
      const previousBedId = editingStudent?.bed_id ?? null;

      if (editingStudent) {
        await updateStudent(editingStudent.id, payload);
        studentId = editingStudent.id;
      } else {
        const created = await createStudent(payload);
        studentId = created.id;
        const bldg = buildings.find((b) => b.id === formData.building_id);
        if (bldg) {
          await createFeeStructure({
            student_id: created.id,
            payment_plan: 'Yearly',
            yearly_fee: bldg.yearly_fee,
            electricity_fee: bldg.electricity_fee,
            non_refundable_fee: bldg.non_refundable_fee,
          });
        }

        // Auto-provision the Supabase Auth login via Edge Function.
        // If the function isn't deployed yet, this fails silently — the
        // admin can run `node scripts/provision-auth.mjs` as a fallback.
        try {
          const { data, error: provErr } = await supabase.functions.invoke(
            'provision-student',
            { body: { student_id: created.id } },
          );
          if (provErr) throw provErr;
          if ((data as { ok?: boolean })?.ok) {
            toast.success(
              `Login ready for ${created.name}: ${created.mobile} / Pg@Welcome123`,
              { duration: 7000 },
            );
          }
        } catch (provErr) {
          const m = provErr instanceof Error ? provErr.message : String(provErr);
          toast.error(
            `Student saved, but auto-login provisioning failed: ${m}. Run scripts/provision-auth.mjs to fix.`,
            { duration: 9000 },
          );
        }
      }

      // Bed re-assignment: only act when the selected bed differs from what
      // the student previously had.
      if (formData.bed_id !== previousBedId) {
        if (previousBedId !== null) {
          await unassignBed(previousBedId);
        }
        if (formData.bed_id !== null) {
          await assignBedToStudent(formData.bed_id, studentId);
        }
      }

      closeForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        'Delete this student? Their bed will be unassigned and they will be removed.',
      )
    )
      return;
    try {
      await deleteStudent(id);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const openView = async (s: StudentRowWithBuilding) => {
    setViewStudent(s);
    setViewFee(null);
    try {
      const fee = await getFeeStructure(s.id);
      setViewFee(fee);
    } catch {
      // ignore — just don't show fee block
    }
  };

  const exportCsv = () => {
    const headers = [
      'Name',
      'Mobile',
      'Parent Mobile',
      'College ID',
      'Branch',
      'Course',
      'Building',
      'Unit',
      'Bed',
      'Fee status',
      'Balance (₹)',
      'Account status',
      'Aadhaar (masked)',
    ];
    const rows = filteredStudents.map((s) => [
      s.name,
      s.mobile,
      s.parent_mobile ?? '',
      s.college_id ?? '',
      s.branch ?? '',
      s.course ?? '',
      s.building_short_name ?? '',
      s.unit_label ?? '',
      s.bed_label ?? '',
      s.fee_payment_status ?? '',
      s.fee_balance != null ? s.fee_balance.toString() : '',
      s.status,
      s.aadhaar_number ? `XXXX-XXXX-${s.aadhaar_number.slice(-4)}` : '',
    ]);
    const escape = (v: string) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${
      isAllBuildings ? 'all' : current?.code ?? 'building'
    }-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      if (feeFilter !== 'all' && s.fee_payment_status !== feeFilter) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.mobile.includes(term) ||
        (s.college_id ?? '').toLowerCase().includes(term) ||
        (s.branch ?? '').toLowerCase().includes(term)
      );
    });
  }, [students, searchTerm, feeFilter]);

  if (buildingLoading || (loading && students.length === 0)) {
    return <div className="text-gray-600">Loading…</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#B85138] font-semibold mb-1">
            {isAllBuildings ? 'All Buildings' : current?.short_name ?? '—'}
          </p>
          <h1 className="text-3xl font-bold text-gray-800">Student Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filteredStudents.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            title="Download visible rows as CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors shadow-sm font-medium text-sm"
          >
            <Plus className="w-5 h-5" />
            Add Student
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
          Failed to load students: {error}
        </div>
      )}

      {showForm && (
        <StudentFormModal
          editing={editingStudent}
          formData={formData}
          setFormData={setFormData}
          aadhaarFile={aadhaarFile}
          setAadhaarFile={setAadhaarFile}
          isAllBuildings={isAllBuildings}
          buildings={buildings}
          availableBeds={availableBeds}
          loadingBeds={loadingBeds}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {viewStudent && (
        <ViewStudentModal
          student={viewStudent}
          fee={viewFee}
          buildings={buildings}
          onClose={() => {
            setViewStudent(null);
            setViewFee(null);
          }}
        />
      )}

      {showBulkReminder && (
        <BulkReminderModal
          students={filteredStudents}
          onClose={() => setShowBulkReminder(false)}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, college ID, or branch…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85138]"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {([
              ['all', 'All'],
              ['Fully Paid', 'Paid'],
              ['Partially Paid', 'Partial'],
              ['Pending', 'Pending'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFeeFilter(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  feeFilter === value
                    ? 'bg-white text-[#B85138] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBulkReminder(true)}
            disabled={
              feeFilter !== 'Pending' && feeFilter !== 'Partially Paid'
            }
            className="flex items-center gap-2 px-3 py-2 bg-[#0F766E] text-white rounded-lg hover:bg-[#0c5e57] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              feeFilter === 'Pending' || feeFilter === 'Partially Paid'
                ? 'Send WhatsApp reminders to filtered students'
                : 'Switch to Pending or Partial filter to enable'
            }
          >
            <MessageCircle className="w-4 h-4" />
            Send fee reminder to all pending
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">College ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Mobile</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Branch</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Bed</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Fee</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {isAllBuildings && (
                        <BuildingTag shortName={s.building_short_name} />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{s.college_id ?? '—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{s.mobile}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{s.branch ?? '—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {s.bed_label && s.unit_label ? (
                      <span>
                        <span className="text-gray-500 text-xs">
                          {s.unit_label}
                        </span>
                        <span className="text-gray-400 mx-1">·</span>
                        {s.bed_label}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {s.fee_payment_status ? (
                      <FeeBadge status={s.fee_payment_status} balance={s.fee_balance} />
                    ) : (
                      <span className="text-xs text-gray-400 italic">no plan</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 items-center">
                      <PhoneActions
                        mobile={s.mobile}
                        whatsappMessage={
                          s.fee_balance != null && s.fee_balance > 0
                            ? feeReminderMessage(
                                s.name,
                                s.fee_balance,
                                s.building_short_name ?? '',
                              )
                            : undefined
                        }
                      />
                      <button
                        onClick={() => openView(s)}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1 text-[#B85138] hover:bg-[#FBE6DD] rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              {students.length === 0
                ? 'No students yet — click “Add Student” to get started.'
                : 'No students match your search.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StudentFormModalProps {
  editing: StudentRow | null;
  formData: FormState;
  setFormData: (s: FormState) => void;
  aadhaarFile: File | null;
  setAadhaarFile: (f: File | null) => void;
  isAllBuildings: boolean;
  buildings: BuildingRow[];
  availableBeds: BedRowEnriched[];
  loadingBeds: boolean;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const INPUT_CLS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B85138] focus:border-[#B85138] disabled:bg-gray-50 disabled:text-gray-500 transition-shadow';

function StudentFormModal({
  editing,
  formData,
  setFormData,
  aadhaarFile,
  setAadhaarFile,
  isAllBuildings: _isAllBuildings,
  buildings,
  availableBeds,
  loadingBeds,
  submitting,
  onSubmit,
  onClose,
}: StudentFormModalProps) {
  const handle = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFormData({ ...formData, [key]: value });

  // Group beds by their parent unit label for a cleaner picker.
  const bedsByUnit = availableBeds.reduce<Record<string, BedRowEnriched[]>>(
    (acc, b) => {
      const key = b.unit_label;
      if (!acc[key]) acc[key] = [];
      acc[key].push(b);
      return acc;
    },
    {},
  );

  const currentBuilding = buildings.find((b) => b.id === formData.building_id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#FBE6DD] via-white to-white rounded-t-xl">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#B85138] font-semibold">
              {editing ? 'Update student' : 'New admission'}
            </p>
            <h2 className="text-xl font-bold text-gray-800">
              {editing ? editing.name : 'Add a student'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-white/70 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form
          onSubmit={onSubmit}
          className="flex-1 overflow-y-auto"
          id="student-form"
        >
          <div className="p-6 space-y-7">
            {/* Personal */}
            <Section title="Personal" subtitle="Who is this student?">
              <Field label="Full name" required>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handle('name', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Rahul Kumar"
                  required
                />
              </Field>
              <Field label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => handle('status', e.target.value as StudentStatus)}
                  className={INPUT_CLS}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <Field label="Mobile number" required hint="10 digits">
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) =>
                    handle('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="9876543210"
                  className={INPUT_CLS}
                  required
                  maxLength={10}
                />
              </Field>
              <Field label="Parent mobile" required hint="10 digits">
                <input
                  type="tel"
                  value={formData.parent_mobile}
                  onChange={(e) =>
                    handle(
                      'parent_mobile',
                      e.target.value.replace(/\D/g, '').slice(0, 10),
                    )
                  }
                  placeholder="9876543200"
                  className={INPUT_CLS}
                  required
                  maxLength={10}
                />
              </Field>
            </Section>

            {/* Academic */}
            <Section title="Academic" subtitle="College / course info">
              <Field label="College ID" hint="optional · unique if set">
                <input
                  type="text"
                  value={formData.college_id}
                  onChange={(e) => handle('college_id', e.target.value)}
                  placeholder="CSE2024001"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Branch / department">
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => handle('branch', e.target.value)}
                  placeholder="Computer Science"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Course">
                <input
                  type="text"
                  value={formData.course}
                  onChange={(e) => handle('course', e.target.value)}
                  placeholder="B.Tech, 2nd year"
                  className={INPUT_CLS}
                />
              </Field>
            </Section>

            {/* Identity */}
            <Section title="Identity" subtitle="Aadhaar (KYC)">
              <FullWidth>
                <MaskedInput
                  label="Aadhaar number"
                  value={formData.aadhaar_number}
                  onChange={(value) => handle('aadhaar_number', value)}
                  required
                />
              </FullWidth>
              <FullWidth>
                <FileUpload
                  label="Aadhaar card image (optional)"
                  currentFileUrl={formData.aadhaar_image_url}
                  onFileSelect={(file) => setAadhaarFile(file)}
                  onFileRemove={() => {
                    setAadhaarFile(null);
                    handle('aadhaar_image_url', '');
                  }}
                />
              </FullWidth>
            </Section>

            {/* Hostel placement */}
            <Section
              title="Hostel placement"
              subtitle="Building + room/bed assignment"
            >
              <Field label="Building" required>
                <select
                  value={formData.building_id ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      building_id: e.target.value ? Number(e.target.value) : null,
                      bed_id: null,
                    })
                  }
                  className={INPUT_CLS}
                  required
                >
                  <option value="">Select a building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.short_name} — {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Room / bed"
                hint={
                  !formData.building_id
                    ? 'Choose a building first'
                    : loadingBeds
                      ? 'Loading available beds…'
                      : `${availableBeds.length} free`
                }
              >
                <select
                  value={formData.bed_id ?? ''}
                  onChange={(e) =>
                    handle('bed_id', e.target.value ? Number(e.target.value) : null)
                  }
                  className={INPUT_CLS}
                  disabled={!formData.building_id || loadingBeds}
                >
                  <option value="">Unassigned · pick later</option>
                  {Object.entries(bedsByUnit).map(([unit, beds]) => (
                    <optgroup key={unit} label={unit}>
                      {beds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.unit_label} · {b.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {currentBuilding && (
                <FullWidth>
                  <div className="text-xs text-gray-500 -mt-1 px-1">
                    Fee plan (auto-created): ₹
                    {currentBuilding.yearly_fee.toLocaleString('en-IN')} yearly
                    {currentBuilding.electricity_fee > 0 &&
                      ` · ₹${currentBuilding.electricity_fee.toLocaleString('en-IN')} electricity`}
                    {' · '}₹
                    {currentBuilding.non_refundable_fee.toLocaleString('en-IN')}{' '}
                    non-refundable
                  </div>
                </FullWidth>
              )}
              {editing && editing.bed_id && formData.bed_id !== editing.bed_id && (
                <FullWidth>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    The student's current bed (#{editing.bed_id}) will be
                    released when you save.
                  </p>
                </FullWidth>
              )}
            </Section>

            {/* Notes */}
            <Section title="Notes" subtitle="Optional — anything important">
              <FullWidth>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handle('notes', e.target.value)}
                  placeholder="Vegetarian, prefers ground floor, etc."
                  className={INPUT_CLS}
                  rows={3}
                />
              </FullWidth>
            </Section>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="student-form"
            disabled={submitting}
            className="px-5 py-2 bg-[#B85138] text-white rounded-lg hover:bg-[#92402C] transition-colors disabled:opacity-50 font-medium shadow-sm text-sm"
          >
            {submitting
              ? 'Saving…'
              : editing
                ? 'Update student'
                : 'Add student'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

function FeeBadge({
  status,
  balance,
}: {
  status: 'Pending' | 'Partially Paid' | 'Fully Paid';
  balance: number | null;
}) {
  const cls =
    status === 'Fully Paid'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : status === 'Partially Paid'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200';
  return (
    <div className="inline-flex flex-col">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${cls} w-fit`}
      >
        {status}
      </span>
      {balance !== null && balance > 0 && (
        <span className="text-[10px] text-gray-500 mt-0.5">
          ₹{balance.toLocaleString('en-IN')} due
        </span>
      )}
    </div>
  );
}

function ViewStudentModal({
  student,
  fee,
  buildings,
  onClose,
}: {
  student: StudentRowWithBuilding;
  fee: FeeStructureRow | null;
  buildings: BuildingRow[];
  onClose: () => void;
}) {
  const [showAllotment, setShowAllotment] = useState(false);
  const [allotmentRoom, setAllotmentRoom] = useState<{
    unit: { label: string; type: string } | null;
    bed: { label: string } | null;
  }>({ unit: null, bed: null });
  const [loadingAllotment, setLoadingAllotment] = useState(false);

  const building = buildings.find((b) => b.id === student.building_id) ?? null;

  const openAllotment = async () => {
    if (!building) {
      toast.error('Student is not assigned to a building yet.');
      return;
    }
    setLoadingAllotment(true);
    try {
      if (student.bed_id) {
        const { data, error } = await supabase
          .from('beds')
          .select('label, units(label, type)')
          .eq('id', student.bed_id)
          .maybeSingle();
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any;
        const unit = row?.units
          ? { label: row.units.label, type: row.units.type }
          : null;
        setAllotmentRoom({
          unit,
          bed: row?.label ? { label: row.label } : null,
        });
      } else {
        setAllotmentRoom({ unit: null, bed: null });
      }
      setShowAllotment(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingAllotment(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-800">{student.name}</h2>
            <BuildingTag shortName={student.building_short_name} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openAllotment}
              disabled={loadingAllotment || !building}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#FBE6DD] text-[#92402C] border border-[#F2C8B5] hover:bg-[#F2C8B5] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                building
                  ? 'Generate printable allotment letter'
                  : 'Assign a building first'
              }
            >
              <FileText className="w-4 h-4" />
              {loadingAllotment ? 'Loading…' : 'Allotment letter'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
        {showAllotment && building && (
          <AllotmentLetter
            student={{
              id: student.id,
              name: student.name,
              college_id: student.college_id,
              mobile: student.mobile,
              parent_mobile: student.parent_mobile,
              course: student.course,
              branch: student.branch,
              aadhaar_number: student.aadhaar_number,
            }}
            building={{
              name: building.name,
              short_name: building.short_name,
              yearly_fee: building.yearly_fee,
              electricity_fee: building.electricity_fee,
              non_refundable_fee: building.non_refundable_fee,
            }}
            unit={allotmentRoom.unit}
            bed={allotmentRoom.bed}
            feeStructure={
              fee
                ? {
                    total_payable: Number(fee.total_payable),
                    payment_plan: fee.payment_plan,
                  }
                : null
            }
            onClose={() => setShowAllotment(false)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">College ID</p>
            <p className="font-medium text-gray-800">{student.college_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Branch</p>
            <p className="font-medium text-gray-800">{student.branch ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Course</p>
            <p className="font-medium text-gray-800">{student.course ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Bed</p>
            <p className="font-medium text-gray-800">
              {student.bed_id ? `#${student.bed_id}` : 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mobile</p>
            <p className="font-medium text-gray-800">{student.mobile}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Parent Mobile</p>
            <p className="font-medium text-gray-800">{student.parent_mobile ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Aadhaar Number</p>
            <p className="font-medium text-gray-800">
              {student.aadhaar_number
                ? `XXXX-XXXX-${student.aadhaar_number.slice(-4)}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                student.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {student.status}
            </span>
          </div>
        </div>

        {student.aadhaar_image_url && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Aadhaar Card</p>
            <img
              src={student.aadhaar_image_url}
              alt="Aadhaar Card"
              className="w-full max-w-md rounded-lg border border-gray-300"
            />
          </div>
        )}

        {student.notes && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Notes</p>
            <p className="text-gray-800 whitespace-pre-line">{student.notes}</p>
          </div>
        )}

        {fee && (
          <div className="mt-4 p-4 bg-[#FBE6DD] border border-[#F2C8B5] rounded-lg">
            <p className="text-xs uppercase tracking-wide text-[#92402C] font-semibold mb-2">
              Fee status
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Total payable</p>
                <p className="font-bold text-gray-800">
                  ₹{fee.total_payable.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Paid</p>
                <p className="font-bold text-emerald-700">
                  ₹{fee.total_paid.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Balance</p>
                <p className="font-bold text-red-700">
                  ₹{fee.balance_amount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {fee.payment_status}
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * Default template used to seed the bulk-reminder editor. Admin can edit this
 * freely; `{name}`, `{balance}`, and `{building}` are replaced per-recipient
 * at send-time. We keep them as literals so the admin can shape the message
 * once and have it personalised when WhatsApp links are opened.
 */
const BULK_TEMPLATE_DEFAULT =
  'Hi {name}, this is a friendly reminder from PG {building}. Your hostel-fee balance is ₹{balance}. Please pay at your earliest convenience. Thanks. — Warden';

function renderBulkTemplate(
  template: string,
  s: StudentRowWithBuilding,
): string {
  const balance = s.fee_balance ?? 0;
  return template
    .replace(/\{name\}/g, s.name)
    .replace(/\{balance\}/g, balance.toLocaleString('en-IN'))
    .replace(/\{building\}/g, s.building_short_name ?? '');
}

function BulkReminderModal({
  students,
  onClose,
}: {
  students: StudentRowWithBuilding[];
  onClose: () => void;
}) {
  const [template, setTemplate] = useState(BULK_TEMPLATE_DEFAULT);
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    students.forEach((s) => {
      init[s.id] = true;
    });
    return init;
  });
  const [sending, setSending] = useState(false);

  const toggle = (id: number) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectedCount = students.filter((s) => checked[s.id]).length;

  const handleSend = () => {
    const selected = students.filter((s) => checked[s.id]);
    if (selected.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    setSending(true);
    // Stagger window.open calls so popup blockers don't merge them. After
    // all windows have been triggered, toast and close.
    selected.forEach((s, i) => {
      setTimeout(() => {
        const message = renderBulkTemplate(template, s);
        const url = whatsappLink(s.mobile, message);
        window.open(url, '_blank');
        if (i === selected.length - 1) {
          toast.success(`Opened ${selected.length} reminders`);
          setSending(false);
          onClose();
        }
      }, i * 300);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#CCFBF1] via-white to-white rounded-t-xl flex-shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#0F766E] font-semibold">
              Bulk WhatsApp
            </p>
            <h2 className="text-lg font-bold text-gray-800">
              Send WhatsApp reminders to {students.length} students
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-white/70 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Message template
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Placeholders: <code>{'{name}'}</code>, <code>{'{balance}'}</code>,{' '}
              <code>{'{building}'}</code> — replaced per recipient at send time.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-700">
                Recipients ({selectedCount}/{students.length} selected)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<number, boolean> = {};
                    students.forEach((s) => {
                      all[s.id] = true;
                    });
                    setChecked(all);
                  }}
                  className="text-[10px] text-[#0F766E] hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setChecked({})}
                  className="text-[10px] text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {students.length === 0 ? (
                <div className="px-3 py-6 text-sm text-gray-500 text-center">
                  No students match the current filter.
                </div>
              ) : (
                students.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[s.id]}
                      onChange={() => toggle(s.id)}
                      className="w-4 h-4 accent-[#0F766E]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {s.mobile}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-700">
                      ₹{(s.fee_balance ?? 0).toLocaleString('en-IN')}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || selectedCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0F766E] text-white rounded-lg hover:bg-[#0c5e57] transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            {sending ? 'Opening…' : `Open in WhatsApp (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
