package com.solar.micro.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoices")
@Getter @Setter @NoArgsConstructor
public class Invoice {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "customer_id", length = 36)
    private String customerId;

    @Column(name = "customer_name")
    private String customerName;

    @Column(precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(precision = 12, scale = 2)
    private BigDecimal gst;

    @Column(precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "supply_type", length = 10)
    private String supplyType;

    @Column(length = 20)
    private String status;

    @Column(name = "invoice_date")
    private LocalDate invoiceDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "source_quotation_id", length = 36)
    private String sourceQuotationId;

    @Column(length = 500)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        if (status == null) status = "Pending";
        if (supplyType == null) supplyType = "intra";
        if (invoiceDate == null) invoiceDate = LocalDate.now();
        if (dueDate == null) dueDate = LocalDate.now().plusDays(30);
    }
}
