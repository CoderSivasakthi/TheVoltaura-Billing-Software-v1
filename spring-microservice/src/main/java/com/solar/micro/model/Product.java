package com.solar.micro.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "products")
@Getter @Setter @NoArgsConstructor
public class Product {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 50)
    private String sku;

    @Column(length = 100)
    private String brand;

    @Column(length = 80)
    private String category;

    @Column(name = "gst_rate", precision = 5, scale = 2)
    private BigDecimal gstRate;

    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @Column
    private Integer stock;

    @Column(length = 20)
    private String status;

    @Column(length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        if (status == null) status = "Active";
        if (stock == null) stock = 0;
        if (gstRate == null) gstRate = BigDecimal.valueOf(18);
    }
}
