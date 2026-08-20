import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/admin/GestionGuideCarte.css";
import { getGuideByCarte, addGuideLine, updateGuideLine, deleteGuideLine, importGuide } from "../../services/guideService";
import { getMachines } from "../../services/machinesService";
import * as XLSX from "xlsx";

function GestionGuideCarte() {
    const navigate = useNavigate();
    const location = useLocation();

    const carte = location.state?.carte;
    const client = location.state?.client;
    const reference = carte?.reference;
    const [lignes, setLignes] = useState([]);
    const [machines, setMachines] = useState([]);

    const [machineNom, setMachineNom] = useState("");
    const [composantReference, setComposantReference] = useState("");
    const [slotNumero, setSlotNumero] = useState("");
    const [position, setPosition] = useState("");
    const [face, setFace] = useState("");
    const [quantite, setQuantite] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [ligneEnEdition, setLigneEnEdition] = useState(null);
    const [editMachineNom, setEditMachineNom] = useState("");
    const [editComposantReference, setEditComposantReference] = useState("");
    const [editSlotNumero, setEditSlotNumero] = useState("");
    const [editPosition, setEditPosition] = useState("");
    const [editFace, setEditFace] = useState("");
    const [editQuantite, setEditQuantite] = useState("");

    const chargerGuide = async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getGuideByCarte(reference);
            setLignes(data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Impossible de charger le guide."
            );
        } finally {
            setLoading(false);
        }
    };

    const chargerMachines = async () => {
        try {
            const data = await getMachines();
            setMachines(data);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Impossible de charger les machines."
            );
        }
    };

    useEffect(() => {
        chargerGuide();
        chargerMachines();
    }, [reference]);

    const ajouterLigne = async (e) => {
        e.preventDefault();

        if (!machineNom || !composantReference || !slotNumero || !face || !quantite) {
            setError("Machine, composant, slot, face et quantité sont obligatoires.");
            return;
        }

        try {
            await addGuideLine(reference, {
                machine_nom: machineNom,
                composant_reference: composantReference.trim(),
                slot_numero: Number(slotNumero),
                position: position ? Number(position) : null,
                face: face,
                quantite: Number(quantite),
            });

            setComposantReference("");
            setPosition(position ? String(Number(position) + 1) : "");
            setError("");

            chargerGuide();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Erreur réseau lors de l'ajout."
            );
        }
    };

    const supprimerLigne = async (id) => {
        const confirmation = window.confirm("Supprimer cette ligne du guide ?");

        if (!confirmation) return;

        try {
            await deleteGuideLine(id);

            chargerGuide();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Erreur réseau lors de la suppression."
            );
        }
    };

    const commencerEdition = (ligne) => {
        setLigneEnEdition(ligne.id);
        setEditMachineNom(ligne.machine_nom);
        setEditComposantReference(ligne.composant_reference);
        setEditSlotNumero(String(ligne.slot_numero));
        setEditPosition(ligne.position !== null ? String(ligne.position) : "");
        setEditFace(ligne.face || "");
        setEditQuantite(String(ligne.quantite));
        setError("");
    };

    const annulerEdition = () => {
        setLigneEnEdition(null);
        setEditMachineNom("");
        setEditComposantReference("");
        setEditSlotNumero("");
        setEditPosition("");
        setEditFace("");
        setEditQuantite("");
    };

    const modifierLigne = async (id) => {
        if (!editMachineNom || !editComposantReference || !editSlotNumero || !editFace || !editQuantite) {
            setError("Machine, composant, slot, face et quantité sont obligatoires.");
            return;
        }

        try {
            await updateGuideLine(id, {
                machine_nom: editMachineNom,
                composant_reference: editComposantReference.trim(),
                slot_numero: Number(editSlotNumero),
                position: editPosition ? Number(editPosition) : null,
                face: editFace,
                quantite: Number(editQuantite),
            });

            annulerEdition();
            chargerGuide();
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Erreur réseau lors de la modification."
            );
        }
    };

    const faceCounts = {};
    const machineCounts = {};
    const slotCounts = {};

    lignes.forEach((ligne) => {
        faceCounts[ligne.face] = (faceCounts[ligne.face] || 0) + 1;

        const machineKey = `${ligne.face}-${ligne.machine_nom}`;
        machineCounts[machineKey] = (machineCounts[machineKey] || 0) + 1;

        const slotKey = `${ligne.face}-${ligne.machine_nom}-${ligne.slot_numero}`;
        slotCounts[slotKey] = (slotCounts[slotKey] || 0) + 1;
    });
    const handleExcelImport = async (event) => {
        const file = event.target.files[0];

        if (!file) return;

        try {

            const buffer = await file.arrayBuffer();

            const workbook = XLSX.read(buffer);

            const lignesImport = [];

            Object.keys(workbook.Sheets).forEach((sheetName) => {

                const face = sheetName.trim().toUpperCase();

                if (face !== "TOP" && face !== "BOT") {
                    return;
                }

                const sheet = workbook.Sheets[sheetName];

                if (!sheet) return;

                const rows = XLSX.utils.sheet_to_json(
                    sheet,
                    {
                        header: 1,
                        blankrows: false
                    }
                );

                let currentMachine = null;

                for (let i = 0; i < rows.length; i++) {

                    const row = rows[i];

                    if (!row || row.length === 0)
                        continue;

                    const firstCell =
                        String(row[0] || "").trim();

                    if (
                        firstCell
                            .toLowerCase()
                            .startsWith("machine")
                    ) {
                        currentMachine = firstCell
                            .replace(/machine\s*:?\s*/i, "")
                            .trim();

                        continue;
                    }

                    if (
                        firstCell.toLowerCase() === "slot"
                    ) {
                        continue;
                    }

                    if (!currentMachine)
                        continue;

                    const slot = row[0];
                    const position = row[1];
                    const composant = row[2];
                    const quantite = row[3];

                    if (
                        slot === undefined ||
                        !composant
                    ) {
                        continue;
                    }

                    lignesImport.push({
                        machine_nom: currentMachine,
                        composant_reference: String(
                            composant
                        ).trim(),
                        slot_numero: Number(slot),
                        position:
                            position !== undefined &&
                                position !== ""
                                ? Number(position)
                                : null,
                        face: face,
                        quantite:
                            Number(quantite)
                    });
                }
            });

            if (lignesImport.length === 0) {
                setError(
                    "Aucune ligne valide trouvée."
                );
                return;
            }

            const confirmation =
                window.confirm(
                    `${lignesImport.length} lignes détectées.\nImporter ?`
                );

            if (!confirmation)
                return;

            await importGuide(
                reference,
                lignesImport
            );

            await chargerGuide();

            alert(
                `${lignesImport.length} lignes importées`
            );

        } catch (err) {

            setError(
                err.response?.data?.detail ||
                "Erreur lors de l'import"
            );
        }
    };
    const telechargerModeleExcel = () => {
        setError("");

        if (machines.length === 0) {
            setError(
                "Impossible de générer le modèle : aucune machine disponible."
            );
            return;
        }

        const workbook = XLSX.utils.book_new();

        ["TOP", "BOT"].forEach((faceName) => {
            const rows = [];

            machines.forEach((machine) => {
                // Machine written once for the entire section
                rows.push([`Machine: ${machine.nom}`]);

                // Required column headers
                rows.push([
                    "Slot",
                    "Position",
                    "Composant",
                    "Quantité"
                ]);

                // Empty lines for the user
                rows.push(["", "", "", ""]);
                rows.push(["", "", "", ""]);
                rows.push(["", "", "", ""]);
                rows.push(["", "", "", ""]);
                rows.push(["", "", "", ""]);

                // Space between machines
                rows.push([]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(rows);

            // Column widths
            worksheet["!cols"] = [
                { width: 12 },
                { width: 14 },
                { width: 35 },
                { width: 14 }
            ];

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                faceName
            );
        });

        const referenceSecurisee = String(reference || "CARTE")
            .replace(/[\\/:*?"<>|]/g, "_");

        XLSX.writeFile(
            workbook,
            `Modele_Guide_${referenceSecurisee}.xlsx`
        );
    };

    return (
        <div className="gg-container">
            <div className="gg-header">
                <button
                    className="gg-back"
                    onClick={() => navigate(-1)}
                >
                    ← Retour
                </button>

                <div>
                    <h1 className="gg-title">Guide de chargement</h1>

                    <p className="gg-subtitle">
                        Carte : {carte?.reference || reference}
                        {client?.nom ? ` | Client : ${client.nom}` : ""}
                    </p>
                </div>
            </div>

            {error && <div className="gg-error">{error}</div>}

            <form className="gg-form" onSubmit={ajouterLigne}>
                <select
                    className="gg-input"
                    value={machineNom}
                    onChange={(e) => setMachineNom(e.target.value)}
                >
                    <option value="">-- Machine --</option>

                    {machines.map((m) => (
                        <option key={m.nom} value={m.nom}>
                            {m.nom}
                        </option>
                    ))}
                </select>

                <input
                    className="gg-input"
                    type="text"
                    placeholder="Référence composant / bobine"
                    value={composantReference}
                    onChange={(e) => setComposantReference(e.target.value)}
                />

                <input
                    className="gg-input"
                    type="number"
                    placeholder="Slot"
                    value={slotNumero}
                    onChange={(e) => setSlotNumero(e.target.value)}
                />

                <input
                    className="gg-input"
                    type="number"
                    placeholder="Position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                />

                <select
                    className="gg-input"
                    value={face}
                    onChange={(e) => setFace(e.target.value)}
                >
                    <option value="">-- Face --</option>
                    <option value="TOP">TOP</option>
                    <option value="BOT">BOT</option>
                </select>

                <input
                    className="gg-input"
                    type="number"
                    placeholder="Quantité"
                    value={quantite}
                    onChange={(e) => setQuantite(e.target.value)}
                />

                <button className="gg-btn gg-btn-add" type="submit">
                    Ajouter ligne
                </button>
            </form>
            <div className="gg-import-section">
                <div className="gg-import-content">
                    <div>
                        <h3 className="gg-import-title">
                            Import Excel
                        </h3>

                        <p className="gg-import-text">
                            Téléchargez le modèle, remplissez les lignes puis importez
                            le fichier. Les feuilles autorisées sont TOP et BOT.
                        </p>
                    </div>

                    <div className="gg-import-actions">
                        <button
                            type="button"
                            className="gg-btn gg-btn-template"
                            onClick={telechargerModeleExcel}
                            disabled={machines.length === 0}
                        >
                            Télécharger le modèle Excel
                        </button>

                        <input
                            id="guide-import"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelImport}
                            hidden
                        />

                        <label
                            htmlFor="guide-import"
                            className="gg-btn gg-btn-import"
                        >
                            Importer un fichier Excel
                        </label>
                    </div>
                </div>
            </div>



            {loading ? (
                <p className="gg-loading">Chargement du guide...</p>
            ) : lignes.length === 0 ? (
                <p className="gg-empty">Aucune ligne guide pour cette carte.</p>
            ) : (
                <table className="gg-table">
                    <thead>
                        <tr>
                            <th>Face</th>
                            <th>Machine</th>
                            <th>Slot</th>
                            <th>Position</th>
                            <th>Composant / Bobine</th>
                            <th>Quantité</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {lignes.map((ligne, index) => {
                            const previous = lignes[index - 1];

                            const isFirstFace =
                                !previous || previous.face !== ligne.face;

                            const isFirstMachine =
                                isFirstFace || previous.machine_nom !== ligne.machine_nom;

                            const isFirstSlot =
                                isFirstMachine || previous.slot_numero !== ligne.slot_numero;

                            const machineKey = `${ligne.face}-${ligne.machine_nom}`;
                            const slotKey = `${ligne.face}-${ligne.machine_nom}-${ligne.slot_numero}`;

                            const enEdition = ligneEnEdition === ligne.id;

                            if (enEdition) {
                                return (
                                    <tr key={ligne.id}>
                                        <td>
                                            <select
                                                className="gg-input"
                                                value={editFace}
                                                onChange={(e) => setEditFace(e.target.value)}
                                            >
                                                <option value="">-- Face --</option>
                                                <option value="TOP">TOP</option>
                                                <option value="BOT">BOT</option>
                                            </select>
                                        </td>

                                        <td>
                                            <select
                                                className="gg-input"
                                                value={editMachineNom}
                                                onChange={(e) => setEditMachineNom(e.target.value)}
                                            >
                                                <option value="">-- Machine --</option>
                                                {machines.map((m) => (
                                                    <option key={m.nom} value={m.nom}>
                                                        {m.nom}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td>
                                            <input
                                                className="gg-input"
                                                type="number"
                                                value={editSlotNumero}
                                                onChange={(e) => setEditSlotNumero(e.target.value)}
                                            />
                                        </td>

                                        <td>
                                            <input
                                                className="gg-input"
                                                type="number"
                                                value={editPosition}
                                                onChange={(e) => setEditPosition(e.target.value)}
                                            />
                                        </td>

                                        <td>
                                            <input
                                                className="gg-input"
                                                type="text"
                                                value={editComposantReference}
                                                onChange={(e) => setEditComposantReference(e.target.value)}
                                            />
                                        </td>

                                        <td>
                                            <input
                                                className="gg-input"
                                                type="number"
                                                value={editQuantite}
                                                onChange={(e) => setEditQuantite(e.target.value)}
                                            />
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="gg-btn gg-btn-add"
                                                onClick={() => modifierLigne(ligne.id)}
                                            >
                                                Enregistrer
                                            </button>

                                            <button
                                                type="button"
                                                className="gg-btn gg-btn-delete"
                                                onClick={annulerEdition}
                                            >
                                                Annuler
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }

                            return (
                                <tr key={ligne.id}>
                                    {isFirstFace && (
                                        <td rowSpan={faceCounts[ligne.face]}>
                                            {ligne.face}
                                        </td>
                                    )}

                                    {isFirstMachine && (
                                        <td rowSpan={machineCounts[machineKey]}>
                                            {ligne.machine_nom}
                                        </td>
                                    )}

                                    {isFirstSlot && (
                                        <td rowSpan={slotCounts[slotKey]}>
                                            {ligne.slot_numero}
                                        </td>
                                    )}

                                    <td>{ligne.position ?? "-"}</td>
                                    <td>{ligne.composant_reference}</td>
                                    <td>{ligne.quantite}</td>

                                    <td>
                                        <button
                                            type="button"
                                            className="gg-btn gg-btn-edit"
                                            onClick={() => commencerEdition(ligne)}
                                        >
                                            Modifier
                                        </button>

                                        <button
                                            type="button"
                                            className="gg-btn gg-btn-delete"
                                            onClick={() => supprimerLigne(ligne.id)}
                                        >
                                            Supprimer
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default GestionGuideCarte;