import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Home, PlusCircle, User, Briefcase, Mail, Calendar, Info, Edit, Trash2, Loader, MessageSquare, Send, Bell, Sparkles, PieChart, LogIn, UserPlus, LogOut } from 'lucide-react';

// --- Firebase Context and Provider ---
const FirebaseContext = createContext(null);

const FirebaseProvider = ({ children }) => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const APP_ID = 'job-tracker-v1';
    useEffect(() => {
        try {
            // --- YOUR FIREBASE CONFIGURATION GOES HERE ---
            // Replace with the actual config copied from Firebase Console (Part 1, Step 2)
            const firebaseConfig = {
              apiKey: "AIzaSyDfrq8KgUw44i_iA7R-6jsC4DCqKF5FDO0", // e.g., "AIzaSy..."
              authDomain: "ai-job-tracker-app.firebaseapp.com", // e.g., "job-tracker-app.firebaseapp.com"
              projectId: "ai-job-tracker-app", // e.g., "job-tracker-app"
              storageBucket: "ai-job-tracker-app.firebasestorage.app", // e.g., "job-tracker-app.appspot.com"
              messagingSenderId: "400703331540", // e.g., "1234567890"
              appId: "1:400703331540:web:4b8a1d778ec7e289af2f41" // e.g., "1:1234567890:web:abcdef"
            };

            // Define your application ID for Firestore paths (matches {appId} in rules)
            const APP_ID = 'job-tracker-v1'; // This should be a constant string for your app

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null); // Clear userId if no user is authenticated
                }
                setIsAuthReady(true); // Mark auth as ready after initial check
            });

            return () => unsubscribe(); // Cleanup auth listener
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            setUserId(null); // Ensure userId is null if Firebase init fails
            setIsAuthReady(true);
        }
    }, []);

    return (
      
        <FirebaseContext.Provider value={{ db, auth, userId, isAuthReady, APP_ID }}>
            {children}
        </FirebaseContext.Provider>
    );
};

// --- Custom Hook for Firebase ---
const useFirebase = () => useContext(FirebaseContext);

// --- Modal Component ---
const Modal = ({ title, message, isOpen, onClose, onConfirm, showConfirmButton = false, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full transform transition-all duration-300 scale-100 opacity-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
                {message && <p className="text-gray-600 mb-6">{message}</p>}
                {children}
                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200"
                    >
                        {showConfirmButton ? 'Cancel' : 'Close'}
                    </button>
                    {showConfirmButton && (
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Loading Spinner Component ---
const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full">
        <Loader className="animate-spin text-blue-500 w-8 h-8" />
    </div>
);

// --- Application List Component ---
const ApplicationList = ({ setCurrentView, setSelectedAppId }) => {
    const { db, userId, isAuthReady, APP_ID } = useFirebase();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        applied: 0,
        interviewing: 0,
        offer: 0,
        rejected: 0
    });

    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        const applicationsCollectionRef = collection(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/applications`);
        const q = query(applicationsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const appList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setApplications(appList);

            // Calculate statistics
            const newStats = {
                total: appList.length,
                applied: appList.filter(app => app.status === 'Applied').length,
                interviewing: appList.filter(app => app.status === 'Interviewing').length,
                offer: appList.filter(app => app.status === 'Offer').length,
                rejected: appList.filter(app => app.status === 'Rejected').length
            };
            setStats(newStats);

            setLoading(false);
        }, (err) => {
            console.error("Error fetching applications:", err);
            setError("Failed to load applications. Please try again.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady, APP_ID]);

    const getFollowUpStatus = (dateTimestamp) => {
        if (!dateTimestamp) return null;
        const followUpDate = new Date(dateTimestamp);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = followUpDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0) return 'Overdue';
        return null;
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    const upcomingFollowUps = applications.filter(app => {
        const status = getFollowUpStatus(app.nextFollowUpDate);
        return status && (status === 'Today' || status === 'Tomorrow' || status.startsWith('In') || status === 'Overdue');
    }).sort((a, b) => (a.nextFollowUpDate || 0) - (b.nextFollowUpDate || 0));

    const otherApplications = applications.filter(app => {
        const status = getFollowUpStatus(app.nextFollowUpDate);
        return !status || (status !== 'Today' && status !== 'Tomorrow' && !status.startsWith('In') && status !== 'Overdue');
    }).sort((a, b) => (b.dateApplied || 0) - (a.dateApplied || 0));

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Your Job Applications Log</h2>

            {/* Statistics Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <PieChart className="w-6 h-6 mr-2 text-blue-500" /> Application Statistics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-blue-50 rounded-md">
                        <p className="text-3xl font-bold text-blue-700">{stats.total}</p>
                        <p className="text-sm text-blue-600">Total</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-3xl font-bold text-gray-700">{stats.applied}</p>
                        <p className="text-sm text-gray-600">Applied</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-md">
                        <p className="text-3xl font-bold text-green-700">{stats.interviewing}</p>
                        <p className="text-sm text-green-600">Interviewing</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-md">
                        <p className="text-3xl font-bold text-purple-700">{stats.offer}</p>
                        <p className="text-sm text-purple-600">Offer</p>
                    </div>
                </div>
            </div>

            {applications.length === 0 ? (
                <div className="bg-blue-50 p-6 rounded-lg text-center text-blue-700">
                    <p className="text-lg">No applications added yet. Start by adding a new one!</p>
                    <button
                        onClick={() => setCurrentView('add_application')}
                        className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center mx-auto"
                    >
                        <PlusCircle className="w-5 h-5 mr-2" /> Add New Application
                    </button>
                </div>
            ) : (
                <>
                    {upcomingFollowUps.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                                <Bell className="w-6 h-6 mr-2 text-orange-500" /> Upcoming Follow-ups
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {upcomingFollowUps.map(app => {
                                    const followUpStatus = getFollowUpStatus(app.nextFollowUpDate);
                                    const statusColorClass = followUpStatus === 'Overdue' ? 'bg-red-100 border-red-300' : 'bg-orange-100 border-orange-300';
                                    const textColorClass = followUpStatus === 'Overdue' ? 'text-red-700' : 'text-orange-700';

                                    return (
                                        <div
                                            key={app.id}
                                            className={`bg-white rounded-lg shadow-md p-6 border ${statusColorClass} cursor-pointer hover:shadow-lg transition-shadow duration-200`}
                                            onClick={() => {
                                                setSelectedAppId(app.id);
                                                setCurrentView('application_detail');
                                            }}
                                        >
                                            <h3 className="text-xl font-semibold text-gray-900 mb-2">{app.companyName}</h3>
                                            <p className="text-gray-700 text-lg mb-2">{app.jobTitle}</p>
                                            <div className="flex items-center text-sm text-gray-500 mb-1">
                                                <Calendar className="w-4 h-4 mr-2" /> Applied: {new Date(app.dateApplied).toLocaleDateString()}
                                            </div>
                                            <div className={`text-sm font-medium ${
                                                app.status === 'Applied' ? 'text-blue-600' :
                                                app.status === 'Interviewing' ? 'text-green-600' :
                                                app.status === 'Offer' ? 'text-purple-600' :
                                                'text-red-600'
                                            }`}>
                                                Status: {app.status}
                                            </div>
                                            {app.nextFollowUpDate && (
                                                <div className={`mt-2 p-2 rounded-md ${textColorClass} font-bold flex items-center`}>
                                                    <Bell className="w-4 h-4 mr-2" /> Follow Up: {new Date(app.nextFollowUpDate).toLocaleDateString()} ({followUpStatus})
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <h3 className="text-xl font-semibold text-gray-800 mb-4">All Applications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {otherApplications.map(app => (
                            <div
                                key={app.id}
                                className="bg-white rounded-lg shadow-md p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                                onClick={() => {
                                    setSelectedAppId(app.id);
                                    setCurrentView('application_detail');
                                }}
                            >
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">{app.companyName}</h3>
                                <p className="text-gray-700 text-lg mb-2">{app.jobTitle}</p>
                                <div className="flex items-center text-sm text-gray-500 mb-1">
                                    <Calendar className="w-4 h-4 mr-2" /> Applied: {new Date(app.dateApplied).toLocaleDateString()}
                                </div>
                                <div className={`text-sm font-medium ${
                                    app.status === 'Applied' ? 'text-blue-600' :
                                    app.status === 'Interviewing' ? 'text-green-600' :
                                    app.status === 'Offer' ? 'text-purple-600' :
                                    'text-red-600'
                                }`}>
                                    Status: {app.status}
                                </div>
                                {app.nextFollowUpDate && (
                                    <div className="mt-2 text-sm text-gray-500 flex items-center">
                                        <Bell className="w-4 h-4 mr-2" /> Next Follow Up: {new Date(app.nextFollowUpDate).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// --- Add Application Form Component ---
const AddApplicationForm = ({ setCurrentView }) => {
    const { db, userId, APP_ID } = useFirebase();
    const [companyName, setCompanyName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [dateApplied, setDateApplied] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState('Applied');
    const [notes, setNotes] = useState('');
    const [nextFollowUpDate, setNextFollowUpDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            setModal({ isOpen: true, title: 'Error', message: 'Database not ready. Please try again.' });
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/applications`), {
                companyName,
                jobTitle,
                dateApplied: new Date(dateApplied).getTime(), // Store as timestamp
                status,
                notes,
                nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).getTime() : null, // Store as timestamp
                userId,
                createdAt: Date.now()
            });
            setModal({ isOpen: true, title: 'Success', message: 'Application added successfully!' });
            setCompanyName('');
            setJobTitle('');
            setDateApplied(new Date().toISOString().split('T')[0]);
            setStatus('Applied');
            setNotes('');
            setNextFollowUpDate('');
            setCurrentView('application_list'); // Go back to list after adding
        } catch (e) {
            console.error("Error adding document: ", e);
            setModal({ isOpen: true, title: 'Error', message: `Failed to add application: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto bg-white rounded-lg shadow-md mt-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">Add New Job Application</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                        type="text"
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input
                        type="text"
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="dateApplied" className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
                    <input
                        type="date"
                        id="dateApplied"
                        value={dateApplied}
                        onChange={(e) => setDateApplied(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                        id="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                    >
                        <option value="Applied">Applied</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Offer">Offer</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="nextFollowUpDate" className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date (Optional)</label>
                    <input
                        type="date"
                        id="nextFollowUpDate"
                        value={nextFollowUpDate}
                        onChange={(e) => setNextFollowUpDate(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                    />
                </div>
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows="3"
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                    ></textarea>
                </div>
                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => setCurrentView('application_list')}
                        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg shadow-md hover:bg-gray-300 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                        disabled={loading}
                    >
                        {loading ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                        {loading ? 'Adding...' : 'Add Application'}
                    </button>
                </div>
            </form>
            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
};

// --- Application Detail Component ---
const ApplicationDetail = ({ selectedAppId, setCurrentView }) => {
    const { db, userId, isAuthReady, APP_ID } = useFirebase();
    const [application, setApplication] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [loadingApp, setLoadingApp] = useState(true);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [error, setError] = useState(null);
    const [isEditingApp, setIsEditingApp] = useState(false);
    const [editedApp, setEditedApp] = useState({});
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', showConfirmButton: false, onConfirm: null });
    const [showAddContactForm, setShowAddContactForm] = useState(false);
    const [aiContactSuggestions, setAiContactSuggestions] = useState([]);
    const [generatingContactSuggestions, setGeneratingContactSuggestions] = useState(false);
    const [generatingFollowUpSuggestion, setGeneratingFollowUpSuggestion] = useState(false);
    const [generatedEmailDraft, setGeneratedEmailDraft] = useState('');
    const [generatingEmailDraft, setGeneratingEmailDraft] = useState(false);
    const [showEmailDraftModal, setShowEmailDraftModal] = useState(false);


    // Fetch application details
    useEffect(() => {
        if (!db || !userId || !isAuthReady || !selectedAppId) return;

        setLoadingApp(true);
        setError(null);
        const appDocRef = doc(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/applications`, selectedAppId);

        const unsubscribe = onSnapshot(appDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const appData = { id: docSnap.id, ...docSnap.data() };
                setApplication(appData);
                setEditedApp({
                    companyName: appData.companyName,
                    jobTitle: appData.jobTitle,
                    dateApplied: new Date(appData.dateApplied).toISOString().split('T')[0],
                    status: appData.status,
                    notes: appData.notes,
                    nextFollowUpDate: appData.nextFollowUpDate ? new Date(appData.nextFollowUpDate).toISOString().split('T')[0] : ''
                });
            } else {
                setError("Application not found.");
            }
            setLoadingApp(false);
        }, (err) => {
            console.error("Error fetching application details:", err);
            setError("Failed to load application details.");
            setLoadingApp(false);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady, selectedAppId, APP_ID]);

    // Fetch contacts for the application
    useEffect(() => {
        if (!db || !userId || !isAuthReady || !selectedAppId) return;

        setLoadingContacts(true);
        const contactsCollectionRef = collection(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/contacts`);
        const q = query(contactsCollectionRef, where("applicationId", "==", selectedAppId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const contactList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setContacts(contactList);
            setLoadingContacts(false);
        }, (err) => {
            console.error("Error fetching contacts:", err);
            setError("Failed to load contacts.");
            setLoadingContacts(false);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady, selectedAppId, APP_ID]);

    const handleUpdateApplication = async () => {
        if (!db || !userId || !selectedAppId) return;
        setLoadingApp(true);
        try {
            await updateDoc(doc(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/applications`, selectedAppId), {
                ...editedApp,
                dateApplied: new Date(editedApp.dateApplied).getTime(), // Convert back to timestamp
                nextFollowUpDate: editedApp.nextFollowUpDate ? new Date(editedApp.nextFollowUpDate).getTime() : null // Convert back to timestamp
            });
            setIsEditingApp(false);
            setModal({ isOpen: true, title: 'Success', message: 'Application updated successfully!' });
        } catch (e) {
            console.error("Error updating application: ", e);
            setModal({ isOpen: true, title: 'Error', message: `Failed to update application: ${e.message}` });
        } finally {
            setLoadingApp(false);
        }
    };

    const handleDeleteApplication = () => {
        setModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this application and all its contacts?',
            showConfirmButton: true,
            onConfirm: async () => {
                if (!db || !userId) return;
                setLoadingApp(true);
                try {
                    // Delete all associated contacts first
                    const contactsToDeleteQuery = query(
                        collection(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/contacts`),
                        where("applicationId", "==", selectedAppId)
                    );
                    const contactsSnapshot = await getDocs(contactsToDeleteQuery);
                    const deleteContactPromises = contactsSnapshot.docs.map(d => deleteDoc(doc(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/contacts`, d.id)));
                    await Promise.all(deleteContactPromises);

                    // Then delete the application
                    await deleteDoc(doc(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/applications`, selectedAppId));
                    setModal({ isOpen: true, title: 'Success', message: 'Application and contacts deleted successfully!' });
                    setCurrentView('application_list'); // Go back to list
                } catch (e) {
                    console.error("Error deleting application: ", e);
                    setModal({ isOpen: true, title: 'Error', message: `Failed to delete application: ${e.message}` });
                } finally {
                    setLoadingApp(false);
                }
            }
        });
    };

    const handleDeleteContact = (contactId) => {
        setModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this contact?',
            showConfirmButton: true,
            onConfirm: async () => {
                if (!db || !userId) return;
                try {
                    await deleteDoc(doc(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/contacts`, contactId));
                    setModal({ isOpen: true, title: 'Success', message: 'Contact deleted successfully!' });
                } catch (e) {
                    console.error("Error deleting contact: ", e);
                    setModal({ isOpen: true, title: 'Error', message: `Failed to delete contact: ${e.message}` });
                }
            }
        });
    };

    const generateContactSuggestions = async () => {
        setGeneratingContactSuggestions(true);
        setAiContactSuggestions([]);
        try {
            // Prompt to specifically ask for Senior Software Engineers
            const prompt = `Suggest 3-5 names and plausible professional email addresses for Senior Software Engineers at a company named "<span class="math-inline">\{application\.companyName\}"\. Focus on common email patterns like firstname\.lastname@company\.com or firstinitiallastname@company\.com\. Provide the output as a JSON array of objects, each with 'name', 'role' \(always "Senior Software Engineer"\), and 'email\_address' fields\. Example\: \[\{"name"\: "Jane Doe", "role"\: "Senior Software Engineer", "email\_address"\: "jane\.doe@</span>{application.companyName.toLowerCase().replace(/\s/g, '')}.com"}]`;
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "name": { "type": "STRING" },
                                "role": { "type": "STRING" },
                                "email_address": { "type": "STRING" }
                            },
                            "propertyOrdering": ["name", "role", "email_address"]
                        }
                    }
                }
            };
            const apiKey = ""; // Leave empty for Canvas or use your actual Gemini API Key
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`; // Using gemini-2.0-flash

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const json = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(json);

                const verifiedSuggestions = [];
                for (const sug of parsedJson) {
                    let verifiedEmail = sug.email_address;
                    let verificationSource = "AI Suggestion";
                    let verificationConfidence = "low";

                    // Call your backend for email verification
                    try {
                        const backendResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/verify-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: sug.email_address,
                                company_domain: application.companyName.toLowerCase().replace(/\s/g, '')
                            })
                        });
                        const backendData = await backendResponse.json();
                        if (backendResponse.ok && backendData.status === 'verified') {
                            verifiedEmail = `${sug.email_address} (Verified by ${backendData.source} - Confidence: ${backendData.confidence})`;
                            verificationSource = backendData.source;
                            verificationConfidence = backendData.confidence;
                        } else {
                            verifiedEmail = `${sug.email_address} (Unverified)`;
                            verificationSource = backendData.source || "None";
                            verificationConfidence = backendData.confidence || "unknown";
                        }
                    } catch (backendError) {
                        console.error("Error calling backend for email verification:", backendError);
                        verifiedEmail = `${sug.email_address} (Verification Failed - Backend Error)`;
                        verificationSource = "Backend Error";
                        verificationConfidence = "unknown";
                    }

                    verifiedSuggestions.push({
                        ...sug,
                        email_address: verifiedEmail,
                        verification_source: verificationSource,
                        verification_confidence: verificationConfidence
                    });
                }
                setAiContactSuggestions(verifiedSuggestions);
            } else {
                setModal({ isOpen: true, title: 'AI Error', message: 'Could not generate contact suggestions. Please try again.' });
            }
        } catch (error) {
            console.error("Error generating AI contact suggestions:", error);
            setModal({ isOpen: true, title: 'AI Error', message: `Failed to generate contact suggestions: ${error.message}` });
        } finally {
            setGeneratingContactSuggestions(false);
        }
    };

    const generateFollowUpSuggestion = async () => {
        setGeneratingFollowUpSuggestion(true);
        try {
            const prompt = `Based on the application status '<span class="math-inline">\{application\.status\}' and notes '</span>{application.notes || "No specific notes."}' for the job "<span class="math-inline">\{application\.jobTitle\}" at "</span>{application.companyName}", when would be a good date for the next follow-up? Provide the date in ISO 8601 format (YYYY-MM-DD). If no follow-up is needed, respond with "N/A".`;
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = ""; // Leave empty for Canvas or use your actual Gemini API Key
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`; // Using gemini-2.0-flash

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const suggestedDate = result.candidates[0].content.parts[0].text.trim();
                if (suggestedDate !== 'N/A' && /^\d{4}-\d{2}-\d{2}$/.test(suggestedDate)) {
                    setEditedApp(prev => ({ ...prev, nextFollowUpDate: suggestedDate }));
                    setModal({ isOpen: true, title: 'AI Suggestion', message: `Suggested follow-up date: ${suggestedDate}. Please review and save changes.` });
                } else {
                    setModal({ isOpen: true, title: 'AI Suggestion', message: 'The AI suggested no specific follow-up date at this time.' });
                }
            } else {
                setModal({ isOpen: true, title: 'AI Error', message: 'Could not generate follow-up suggestion. Please try again.' });
            }
        } catch (error) {
            console.error("Error generating AI follow-up suggestion:", error);
            setModal({ isOpen: true, title: 'AI Error', message: `Failed to generate follow-up suggestion: ${error.message}` });
        } finally {
            setGeneratingFollowUpSuggestion(false);
        }
    };

    const generateOutreachEmail = async (contactName, contactRole) => {
        setGeneratingEmailDraft(true);
        setGeneratedEmailDraft('');
        try {
            const prompt = `Draft a concise, professional, and polite initial outreach email to ${contactName}, a ${contactRole} at ${application.companyName}, regarding my application for the ${application.jobTitle} position. Include placeholders for my name, a brief mention of my interest, and a call to action to connect. Do not include a subject line.`;
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = ""; // Leave empty for Canvas or use your actual Gemini API Key
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`; // Using gemini-2.0-flash

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                setGeneratedEmailDraft(result.candidates[0].content.parts[0].text);
                setShowEmailDraftModal(true);
            } else {
                setModal({ isOpen: true, title: 'AI Error', message: 'Could not generate email draft. Please try again.' });
            }
        } catch (error) {
            console.error("Error generating email draft:", error);
            setModal({ isOpen: true, title: 'AI Error', message: `Failed to generate email draft: ${error.message}` });
        } finally {
            setGeneratingEmailDraft(false);
        }
    };


    if (loadingApp || !application) return <LoadingSpinner />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto bg-white rounded-lg shadow-md mt-8">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => setCurrentView('application_list')}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200 flex items-center"
                >
                    <Home className="w-4 h-4 mr-2" /> Back to List
                </button>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsEditingApp(!isEditingApp)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 flex items-center"
                    >
                        <Edit className="w-4 h-4 mr-2" /> {isEditingApp ? 'Cancel Edit' : 'Edit Application'}
                    </button>
                    <button
                        onClick={handleDeleteApplication}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 flex items-center"
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Application
                    </button>
                </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">{application.companyName} - {application.jobTitle}</h2>

            {isEditingApp ? (
                <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Edit Application Details</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="editCompanyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <input
                                type="text"
                                id="editCompanyName"
                                value={editedApp.companyName}
                                onChange={(e) => setEditedApp({ ...editedApp, companyName: e.target.value })}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="editJobTitle" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                            <input
                                type="text"
                                id="editJobTitle"
                                value={editedApp.jobTitle}
                                onChange={(e) => setEditedApp({ ...editedApp, jobTitle: e.target.value })}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="editDateApplied" className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
                            <input
                                type="date"
                                id="editDateApplied"
                                value={editedApp.dateApplied}
                                onChange={(e) => setEditedApp({ ...editedApp, dateApplied: e.target.value })}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="editStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                id="editStatus"
                                value={editedApp.status}
                                onChange={(e) => setEditedApp({ ...editedApp, status: e.target.value })}
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="Applied">Applied</option>
                                <option value="Interviewing">Interviewing</option>
                                <option value="Offer">Offer</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="editNextFollowUpDate" className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date (Optional)</label>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="date"
                                    id="editNextFollowUpDate"
                                    value={editedApp.nextFollowUpDate}
                                    onChange={(e) => setEditedApp({ ...editedApp, nextFollowUpDate: e.target.value })}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={generateFollowUpSuggestion}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-md hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center"
                                    disabled={generatingFollowUpSuggestion}
                                >
                                    {generatingFollowUpSuggestion ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <><Sparkles className="w-5 h-5 mr-2" /> Suggest Date</>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="editNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                id="editNotes"
                                value={editedApp.notes}
                                onChange={(e) => setEditedApp({ ...editedApp, notes: e.target.value })}
                                rows="3"
                                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm"
                            ></textarea>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleUpdateApplication}
                                className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 flex items-center"
                                disabled={loadingApp}
                            >
                                {loadingApp ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <Edit className="w-5 h-5 mr-2" />}
                                {loadingApp ? 'Updating...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                    <p className="text-gray-700 text-lg mb-2 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-gray-500" /> <span className="font-semibold">Company:</span> {application.companyName}</p>
                    <p className="text-gray-700 text-lg mb-2 flex items-center"><Info className="w-5 h-5 mr-2 text-gray-500" /> <span className="font-semibold">Job Title:</span> {application.jobTitle}</p>
                    <p className="text-gray-700 text-lg mb-2 flex items-center"><Calendar className="w-5 h-5 mr-2 text-gray-500" /> <span className="font-semibold">Date Applied:</span> {new Date(application.dateApplied).toLocaleDateString()}</p>
                    <p className={`text-lg font-semibold mb-2 flex items-center ${
                        application.status === 'Applied' ? 'text-blue-600' :
                        application.status === 'Interviewing' ? 'text-green-600' :
                        application.status === 'Offer' ? 'text-purple-600' :
                        'text-red-600'
                    }`}>
                        <MessageSquare className="w-5 h-5 mr-2" /> Status: {application.status}
                    </p>
                    {application.nextFollowUpDate && (
                        <p className="text-gray-700 text-lg mb-2 flex items-center"><Bell className="w-5 h-5 mr-2 text-orange-500" /> <span className="font-semibold">Next Follow Up:</span> {new Date(application.nextFollowUpDate).toLocaleDateString()}</p>
                    )}
                    {application.notes && (
                        <p className="text-gray-700 text-lg flex items-start"><span className="font-semibold mr-2 flex-shrink-0">Notes:</span> {application.notes}</p>
                    )}
                </div>
            )}

            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Contacts for this Application</h3>
            {contacts.length === 0 && !showAddContactForm ? (
                <div className="bg-yellow-50 p-4 rounded-lg text-center text-yellow-700 mb-4">
                    <p>No contacts added yet. Click "Add New Contact" to start.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {contacts.map(contact => (
                        <div key={contact.id} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 relative">
                            <h4 className="text-lg font-semibold text-gray-900 mb-1 flex items-center"><User className="w-4 h-4 mr-2" /> {contact.name}</h4>
                            <p className="text-gray-700 text-sm mb-1 flex items-center"><Briefcase className="w-4 h-4 mr-2" /> {contact.role}</p>
                            <p className="text-gray-700 text-sm mb-1 flex items-center"><Mail className="w-4 h-4 mr-2" /> {contact.email}</p>
                            {contact.dateReachedOut && (
                                <p className="text-gray-500 text-xs flex items-center"><Calendar className="w-3 h-3 mr-1" /> Reached out: {new Date(contact.dateReachedOut).toLocaleDateString()}</p>
                            )}
                            {contact.notes && (
                                <p className="text-gray-600 text-sm mt-1">Notes: {contact.notes}</p>
                            )}
                            <div className="flex justify-end space-x-2 mt-3">
                                <button
                                    onClick={() => generateOutreachEmail(contact.name, contact.role)}
                                    className="px-3 py-1 bg-indigo-500 text-white rounded-md text-sm hover:bg-indigo-600 transition-colors duration-200 flex items-center"
                                    disabled={generatingEmailDraft}
                                >
                                    {generatingEmailDraft ? <Loader className="animate-spin w-4 h-4 mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                                    Email
                                </button>
                                <button
                                    onClick={() => handleDeleteContact(contact.id)}
                                    className="px-3 py-1 bg-red-400 text-white rounded-md text-sm hover:bg-red-500 transition-colors duration-200 flex items-center"
                                    aria-label="Delete contact"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!showAddContactForm && (
                <div className="flex justify-center mt-6">
                    <button
                        onClick={() => setShowAddContactForm(true)}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                    >
                        <PlusCircle className="w-5 h-5 mr-2" /> Add New Contact
                    </button>
                </div>
            )}

            {showAddContactForm && (
                <AddContactForm
                    applicationId={selectedAppId}
                    onContactAdded={() => setShowAddContactForm(false)}
                    onCancel={() => setShowAddContactForm(false)}
                    companyName={application.companyName}
                    generateContactSuggestions={generateContactSuggestions}
                    generatingContactSuggestions={generatingContactSuggestions}
                    aiContactSuggestions={aiContactSuggestions}
                    setAiContactSuggestions={setAiContactSuggestions}
                />
            )}

            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                onClose={() => setModal({ ...modal, isOpen: false, onConfirm: null })}
                onConfirm={modal.onConfirm}
                showConfirmButton={modal.showConfirmButton}
            />

            {/* Email Draft Modal */}
            <Modal
                isOpen={showEmailDraftModal}
                title="✨ AI Generated Email Draft"
                onClose={() => setShowEmailDraftModal(false)}
            >
                <div className="bg-gray-100 p-4 rounded-md border border-gray-200 mb-4">
                    <textarea
                        className="w-full h-48 p-2 bg-transparent border-none focus:outline-none resize-none font-mono text-sm"
                        value={generatedEmailDraft}
                        readOnly
                    />
                </div>
                <button
                    onClick={() => {
                        // Fallback for navigator.clipboard.writeText due to iframe restrictions
                        const el = document.createElement('textarea');
                        el.value = generatedEmailDraft;
                        document.body.appendChild(el);
                        el.select();
                        document.execCommand('copy');
                        document.body.removeChild(el);
                        setModal({ isOpen: true, title: 'Copied!', message: 'Email draft copied to clipboard.' });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center mx-auto"
                >
                    Copy to Clipboard
                </button>
            </Modal>
        </div>
    );
};

// --- Add Contact Form Component ---
const AddContactForm = ({ applicationId, onContactAdded, onCancel, companyName, generateContactSuggestions, generatingContactSuggestions, aiContactSuggestions, setAiContactSuggestions }) => {
    const { db, userId, APP_ID } = useFirebase();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('');
    const [dateReachedOut, setDateReachedOut] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            setModal({ isOpen: true, title: 'Error', message: 'Database not ready. Please try again.' });
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, `artifacts/<span class="math-inline">\{APP\_ID\}/users/</span>{userId}/contacts`), {
                applicationId,
                name,
                email,
                role,
                dateReachedOut: dateReachedOut ? new Date(dateReachedOut).getTime() : null,
                notes,
                userId,
                createdAt: Date.now()
            });
            setModal({ isOpen: true, title: 'Success', message: 'Contact added successfully!' });
            setName('');
            setEmail('');
            setRole('');
            setDateReachedOut('');
            setNotes('');
            setAiContactSuggestions([]); // Clear AI suggestions after adding contact
            onContactAdded();
        } catch (e) {
            console.error("Error adding contact: ", e);
            setModal({ isOpen: true, title: 'Error', message: `Failed to add contact: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleUseSuggestion = (suggestion) => {
        setName(suggestion.name);
        setEmail(suggestion.email_address.split(' ')[0]); // Extract just the email if verification status is appended
        setRole(suggestion.role);
        setAiContactSuggestions([]); // Clear suggestions after one is used
    };

    return (
        <div className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200 mt-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Add New Contact</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                    <div className="flex-1">
                        <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            id="contactName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            id="contactEmail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                            required
                        />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                    <div className="flex-1">
                        <label htmlFor="contactRole" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <input
                            type="text"
                            id="contactRole"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                            placeholder="e.g., Senior Software Engineer"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="dateReachedOut" className="block text-sm font-medium text-gray-700 mb-1">Date Reached Out (Optional)</label>
                        <input
                            type="date"
                            id="dateReachedOut"
                            value={dateReachedOut}
                            onChange={(e) => setDateReachedOut(e.target.value)}
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="contactNotes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea
                        id="contactNotes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows="2"
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                    ></textarea>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <User className="w-5 h-5 mr-2" /> AI Contact Suggestions for {companyName}
                    </h4>
                    <div className="flex items-center space-x-2 mb-4">
                        <button
                            type="button"
                            onClick={generateContactSuggestions}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-md hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center"
                            disabled={generatingContactSuggestions}
                        >
                            {generatingContactSuggestions ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <><Sparkles className="w-5 h-5 mr-2" /> Generate Suggestions</>}
                        </button>
                    </div>

                    {aiContactSuggestions.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h5 className="font-semibold text-blue-800 mb-2">Suggested Contacts (Verify Emails!):</h5>
                            <ul className="list-disc list-inside space-y-2">
                                {aiContactSuggestions.map((sug, index) => (
                                    <li key={index} className="text-blue-700">
                                        <strong>{sug.name}</strong> ({sug.role}) - {sug.email_address}
                                        <button
                                            type="button"
                                            onClick={() => handleUseSuggestion(sug)}
                                            className="ml-3 px-3 py-1 text-xs bg-blue-200 text-blue-800 rounded-full hover:bg-blue-300 transition-colors duration-200"
                                        >
                                            Use this
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg shadow-md hover:bg-gray-300 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                        disabled={loading}
                    >
                        {loading ? <Loader className="animate-spin w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                        {loading ? 'Adding...' : 'Add Contact'}
                    </button>
                </div>
            </form>
            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
};

// --- Auth Forms Component ---
const AuthForms = ({ onLoginSuccess }) => {
    const { auth } = useFirebase();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

    const handleAuth = async (e) => {
        e.preventDefault();
        if (!auth) {
            setModal({ isOpen: true, title: 'Error', message: 'Firebase Auth not initialized.' });
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            // onAuthStateChanged listener in FirebaseProvider will handle state update
        } catch (error) {
            console.error("Auth error:", error);
            let errorMessage = "An unknown error occurred.";
            if (error.code) {
                switch (error.code) {
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address format.';
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 'auth/email-already-in-use':
                        errorMessage = 'Email already registered. Try logging in.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password should be at least 6 characters.';
                        break;
                    default:
                        errorMessage = `Authentication failed: ${error.message}`;
                }
            }
            setModal({ isOpen: true, title: 'Authentication Error', message: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-md mx-auto bg-white rounded-lg shadow-md mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">
                {isLogin ? 'Login' : 'Register'}
            </h2>
            <form onSubmit={handleAuth} className="space-y-5">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base"
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                    disabled={loading}
                >
                    {loading ? <Loader className="animate-spin w-5 h-5 mr-2" /> : (isLogin ? <LogIn className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />)}
                    {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
                </button>
            </form>
            <p className="mt-6 text-center text-gray-600">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-blue-600 hover:underline font-medium"
                >
                    {isLogin ? 'Register' : 'Login'}
                </button>
            </p>
            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                onClose={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
};


// --- Main App Component ---
const App = () => {
    const [currentView, setCurrentView] = useState('application_list'); // 'application_list', 'add_application', 'application_detail'
    const [selectedAppId, setSelectedAppId] = useState(null);
    const { userId, isAuthReady, auth } = useFirebase();

    const handleLogout = async () => {
        if (auth) {
            try {
                await signOut(auth);
                setCurrentView('application_list'); // Reset view for next login
            } catch (error) {
                console.error("Error logging out:", error);
                // Optionally show a modal error
            }
        }
    };

    // Ensure the app waits for Firebase auth to be ready
    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <LoadingSpinner />
                <p className="ml-3 text-gray-600">Initializing app...</p>
            </div>
        );
    }

    // If no user is logged in, show authentication forms
    if (!userId) {
        return <AuthForms />;
    }

    return (
        <div className="min-h-screen bg-gray-100 font-inter text-gray-900">
            <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
                <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                    <h1 className="text-2xl font-bold mb-2 sm:mb-0">AI Job Tracker</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                            User ID: {userId || 'Loading...'}
                        </span>
                        <nav>
                            <ul className="flex space-x-4">
                                <li>
                                    <button
                                        onClick={() => setCurrentView('application_list')}
                                        className={`flex items-center px-3 py-2 rounded-md transition-colors duration-200 ${currentView === 'application_list' ? 'bg-white text-blue-600 shadow-md' : 'hover:bg-white hover:bg-opacity-20'}`}
                                    >
                                        <Home className="w-5 h-5 mr-1" />
                                        Applications
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => setCurrentView('add_application')}
                                        className={`flex items-center px-3 py-2 rounded-md transition-colors duration-200 ${currentView === 'add_application' ? 'bg-white text-blue-600 shadow-md' : 'hover:bg-white hover:bg-opacity-20'}`}
                                    >
                                        <PlusCircle className="w-5 h-5 mr-1" />
                                        Add New
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center px-3 py-2 rounded-md transition-colors duration-200 hover:bg-white hover:bg-opacity-20"
                                    >
                                        <LogOut className="w-5 h-5 mr-1" />
                                        Logout
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8">
                {(() => {
                    switch (currentView) {
                        case 'application_list':
                            return <ApplicationList setCurrentView={setCurrentView} setSelectedAppId={setSelectedAppId} />;
                        case 'add_application':
                            return <AddApplicationForm setCurrentView={setCurrentView} />;
                        case 'application_detail':
                            return <ApplicationDetail selectedAppId={selectedAppId} setCurrentView={setCurrentView} />;
                        default:
                            return <ApplicationList setCurrentView={setCurrentView} setSelectedAppId={setSelectedAppId} />;
                    }
                })()}
            </main>
        </div>
    );
};

// --- Root App Component with Firebase Provider ---
// This is the component that index.js will render.
const RootApp = () => (
    <FirebaseProvider>
        <App />
    </FirebaseProvider>
);

export default RootApp;