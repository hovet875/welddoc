import { useAuth } from "@react/auth/AuthProvider";
import { NdtCertModal } from "@react/features/certs/components/NdtCertModal";
import { NdtCertPanel } from "@react/features/certs/components/NdtCertPanel";
import { WelderCertModal } from "@react/features/certs/components/WelderCertModal";
import { WelderCertPanel } from "@react/features/certs/components/WelderCertPanel";
import { useCertsData } from "@react/features/certs/hooks/useCertsData";
import { useCertsPageState } from "@react/features/certs/hooks/useCertsPageState";
import { AppPdfPreviewModal } from "@react/ui/AppPdfPreviewModal";
import { AppButton } from "@react/ui/AppButton";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";

export function CertsPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;
  const certsData = useCertsData();
  const {
    welders,
    welderCerts,
    ndtCerts,
    standards,
    fmGroups,
    materials,
    weldingProcesses,
    ndtMethods,
    ndtSuppliers,
    ndtInspectors,
    jointTypes,
    loading,
    refreshing,
    error,
    reload,
  } = certsData;

  const pageState = useCertsPageState({
    welders,
    welderCerts,
    ndtCerts,
    standards,
    fmGroups,
    materials,
    weldingProcesses,
    ndtMethods,
    ndtSuppliers,
    ndtInspectors,
    jointTypes,
    reload,
  });

  return (
    <AppPageLayout pageClassName="page-certs-react" displayName={displayName} email={email}>
      <AppSectionHeader
        title="Sveisesertifikater"
        subtitle="Bibliotek for sveisesertifikater og NDT-personell sertifikater."
        actions={
          <>
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => pageState.setWelderModal({ opened: true, mode: "new", rowId: null })}>
                Legg til sveisesertifikat
              </AppButton>
            ) : null}
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => pageState.setNdtModal({ opened: true, mode: "new", rowId: null })}>
                Legg til NDT-sertifikat
              </AppButton>
            ) : null}
            <AppRefreshIconButton onClick={() => void reload()} loading={refreshing} disabled={loading} />
          </>
        }
      />

        <WelderCertPanel
          filters={pageState.welderFilters}
          onChangeFilters={pageState.setWelderFilters}
          welderFilterOptions={pageState.welderFilterOptions}
          materialFilterOptions={pageState.materialFilterOptions}
          jointTypeFilterOptions={pageState.jointTypeFilterOptions}
          groups={pageState.welderGroups}
          loading={loading}
          error={error}
          meta={pageState.welderMeta}
          hasFilters={pageState.hasWelderFilters}
          isAdmin={isAdmin}
          standardsByLabel={pageState.standardsByLabel}
          onOpenPdf={(ref, title) => {
            void pageState.openPdfPreview("welder", ref, title);
          }}
          onEdit={(row) => pageState.setWelderModal({ opened: true, mode: "edit", rowId: row.id })}
          onRenew={(row) => pageState.setWelderModal({ opened: true, mode: "renew", rowId: row.id })}
          onDelete={pageState.requestDeleteWelder}
        />

        <NdtCertPanel
          filters={pageState.ndtFilters}
          onChangeFilters={pageState.setNdtFilters}
          companyOptions={pageState.ndtCompanyFilterOptions}
          methodOptions={pageState.ndtMethodFilterOptions}
          groups={pageState.ndtGroups}
          loading={loading}
          error={error}
          meta={pageState.ndtMeta}
          hasFilters={pageState.hasNdtFilters}
          isAdmin={isAdmin}
          onOpenPdf={(ref, title) => {
            void pageState.openPdfPreview("ndt", ref, title);
          }}
          onEdit={(row) => pageState.setNdtModal({ opened: true, mode: "edit", rowId: row.id })}
          onRenew={(row) => pageState.setNdtModal({ opened: true, mode: "renew", rowId: row.id })}
          onDelete={pageState.requestDeleteNdt}
        />

      <WelderCertModal
        opened={pageState.welderModal.opened}
        mode={pageState.welderModal.mode}
        row={pageState.selectedWelderRow}
        welderOptions={pageState.welderModalOptions.welderOptions}
        standardOptions={pageState.welderModalOptions.standardOptions}
        processOptions={pageState.welderModalOptions.processOptions}
        materialOptions={pageState.welderModalOptions.materialOptions}
        jointTypeOptions={pageState.welderModalOptions.jointTypeOptions}
        standards={pageState.standards}
        fmGroups={pageState.fmGroups}
        onClose={pageState.closeWelderModal}
        onSubmit={pageState.handleWelderModalSubmit}
        onOpenExistingPdf={(ref) => {
          void pageState.openPdfPreview("welder", ref, "Sveisesertifikat");
        }}
      />

      <NdtCertModal
        opened={pageState.ndtModal.opened}
        mode={pageState.ndtModal.mode}
        row={pageState.selectedNdtRow}
        companyOptions={pageState.ndtModalOptions.companyOptions}
        methodOptions={pageState.ndtModalOptions.methodOptions}
        inspectorOptionsByCompany={pageState.ndtModalOptions.inspectorOptionsByCompany}
        onClose={pageState.closeNdtModal}
        onSubmit={pageState.handleNdtModalSubmit}
        onOpenExistingPdf={(ref) => {
          void pageState.openPdfPreview("ndt", ref, "NDT-sertifikat");
        }}
      />

      <AppPdfPreviewModal preview={pageState.pdfPreview} onClose={pageState.closePdfPreview} />
      {pageState.deleteConfirmModal}
    </AppPageLayout>
  );
}
